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
export class FrameDecoder {
  private buf: Buffer = Buffer.alloc(0);
  private fragments: Buffer[] = [];
  private socket: Socket;
  private handler: FrameHandler;
  constructor(socket: Socket, handler: FrameHandler) {
    this.socket = socket;
    this.handler = handler;
  }

  feed(chunk: Buffer): void {
    this.buf = Buffer.concat([this.buf, chunk]);
    for (;;) {
      const frame = this.tryParse();
      if (!frame) return;
      const { fin, opcode, payload } = frame;
      if (opcode === OPCODES.ping) { this.socket.write(encodePong(payload)); continue; }
      if (opcode === OPCODES.pong) continue;
      if (opcode === OPCODES.close) { this.socket.write(encodeClose()); this.handler.onClose(); continue; }
      if (opcode === 0x0 || opcode === OPCODES.text) {
        this.fragments.push(payload);
        if (fin) {
          this.handler.onText(Buffer.concat(this.fragments).toString("utf8"));
          this.fragments = [];
        }
      }
    }
  }

  private tryParse(): { fin: boolean; opcode: number; payload: Buffer } | null {
    const b = this.buf;
    if (b.length < 2) return null;
    const fin = (b[0] & 0x80) !== 0;
    const opcode = b[0] & 0x0f;
    const masked = (b[1] & 0x80) !== 0;
    let len = b[1] & 0x7f;
    let off = 2;
    if (len === 126) {
      if (b.length < 4) return null;
      len = b.readUInt16BE(2); off = 4;
    } else if (len === 127) {
      if (b.length < 10) return null;
      len = Number(b.readBigUInt64BE(2)); off = 10;
    }
    const maskLen = masked ? 4 : 0;
    if (b.length < off + maskLen + len) return null;
    let payload = b.subarray(off + maskLen, off + maskLen + len);
    if (masked) {
      const mask = b.subarray(off, off + 4);
      const un = Buffer.alloc(len);
      for (let i = 0; i < len; i++) un[i] = payload[i] ^ mask[i % 4];
      payload = un;
    }
    this.buf = b.subarray(off + maskLen + len);
    return { fin, opcode, payload };
  }
}
