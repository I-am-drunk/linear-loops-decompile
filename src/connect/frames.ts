/**
 * Minimal RFC 6455 WebSocket framing (text frames), zero dependencies.
 * Server side only; browsers and Node 22 clients use their native WebSocket.
 * Handles: masking, 16/64-bit lengths, fragmentation, ping/pong, close.
 */

import { createHash } from "node:crypto";
import type { Socket } from "node:net";

const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

export function acceptKey(secKey: string): string {
  return createHash("sha1").update(secKey + GUID).digest("base64");
}

export const OPCODES = { text: 0x1, close: 0x8, ping: 0x9, pong: 0xa } as const;

export function encodeText(payload: string): Buffer {
  const data = Buffer.from(payload, "utf8");
  const len = data.length;
  let header: Buffer;
  if (len < 126) {
    header = Buffer.from([0x81, len]);
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81; header[1] = 126; header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81; header[1] = 127; header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, data]);
}

export function encodePong(payload: Buffer): Buffer {
  const header = Buffer.from([0x8a, payload.length]);
  return Buffer.concat([header, payload]);
}

export function encodeClose(): Buffer {
  return Buffer.from([0x88, 0x00]);
}

type FrameHandler = {
  onText(text: string): void;
  onClose(): void;
};

/**
 * Incremental frame decoder bound to one socket. Feed it chunks; it emits
 * whole text messages (reassembling fragments) and answers pings itself.
 */
export const PRE_AUTH_MESSAGE_BYTES = 4096;
export const MAX_MESSAGE_BYTES = 1024 * 1024;

export class FrameDecoder {
  private header = Buffer.alloc(14);
  private headerUsed = 0;
  private headerNeeded = 2;
  private payload: Buffer | null = null;
  private payloadUsed = 0;
  private fragments: Buffer[] = [];
  private fragmentBytes = 0;
  private fragmented = false;
  private closed = false;
  private socket: Socket;
  private handler: FrameHandler;
  private limit: () => number;

  constructor(socket: Socket, handler: FrameHandler, limit: () => number = () => MAX_MESSAGE_BYTES) {
    this.socket = socket;
    this.handler = handler;
    this.limit = limit;
  }

  private close(): void {
    this.closed = true;
    this.payload = null;
    this.fragments = [];
    this.socket.write(encodeClose());
    this.handler.onClose();
  }

  feed(chunk: Buffer): void {
    let offset = 0;
    while (!this.closed && offset < chunk.length) {
      if (this.payload === null) {
        const count = Math.min(this.headerNeeded - this.headerUsed, chunk.length - offset);
        chunk.copy(this.header, this.headerUsed, offset, offset + count);
        this.headerUsed += count;
        offset += count;
        if (this.headerUsed < this.headerNeeded) return;
        if (this.headerNeeded === 2) {
          const size = this.header[1] & 0x7f;
          this.headerNeeded = 2 + (size === 126 ? 2 : size === 127 ? 8 : 0) + 4;
          // Client frames MUST be masked; extensions/binary frames are unsupported.
          if ((this.header[0] & 0x70) || !(this.header[1] & 0x80)) { this.close(); return; }
          continue;
        }
        const opcode = this.header[0] & 0x0f;
        const fin = (this.header[0] & 0x80) !== 0;
        const size = this.header[1] & 0x7f;
        const length = size === 126 ? BigInt(this.header.readUInt16BE(2))
          : size === 127 ? this.header.readBigUInt64BE(2) : BigInt(size);
        const control = opcode >= 8;
        if (![0, 1, 8, 9, 10].includes(opcode)
            || (control && (!fin || length > 125n))
            || (!control && ((opcode === 0) !== this.fragmented))
            || length > BigInt(this.limit())
            || (!control && BigInt(this.fragmentBytes) + length > BigInt(this.limit()))
            || (!control && this.fragments.length >= 1024)) {
          this.close(); return;
        }
        // Allocate once only after checking the declared size. Each incoming byte
        // is copied once, regardless of how many TCP chunks carry the frame.
        this.payload = Buffer.alloc(Number(length));
        this.payloadUsed = 0;
      }
      const payload = this.payload;
      const count = Math.min(payload.length - this.payloadUsed, chunk.length - offset);
      const maskOffset = this.headerNeeded - 4;
      for (let i = 0; i < count; i++) {
        payload[this.payloadUsed + i] = chunk[offset + i] ^ this.header[maskOffset + (this.payloadUsed + i) % 4];
      }
      this.payloadUsed += count;
      offset += count;
      if (this.payloadUsed !== payload.length) return;
      const opcode = this.header[0] & 0x0f;
      const fin = (this.header[0] & 0x80) !== 0;
      this.payload = null;
      this.headerUsed = 0;
      this.headerNeeded = 2;
      if (opcode === OPCODES.close) { this.close(); return; }
      if (opcode === OPCODES.ping) { this.socket.write(encodePong(payload)); continue; }
      if (opcode === OPCODES.pong) continue;
      this.fragments.push(payload);
      this.fragmentBytes += payload.length;
      this.fragmented = !fin;
      if (fin) {
        const text = Buffer.concat(this.fragments, this.fragmentBytes).toString("utf8");
        this.fragments = [];
        this.fragmentBytes = 0;
        this.handler.onText(text);
        if (this.socket.destroyed) this.closed = true;
      }
    }
  }
}
