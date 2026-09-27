/**
 * Minimal RFC 6455 server-side WebSocket codec (T-902).
 *
 * Node has no built-in WS *server*, and the house rule is zero runtime deps,
 * so the frame codec lives here. Scope is deliberately narrow — just what the
 * connect channel needs:
 * - HTTP Upgrade validation + 101 response (with subprotocol selection).
 * - Frame parse: masked client frames (mask REQUIRED per RFC 6455 §5.3 — an
 *   unmasked client frame gets a protocol close), 7/16/64-bit lengths,
 *   fragmentation reassembly, message size cap.
 * - Control frames: close (echoed), ping (answered with pong), pong (tracked).
 * - Text messages only at the API surface; binary frames are refused (1003),
 *   matching the channel's JSON-only wire protocol.
 * - UTF-8 validated on assembled text messages (1007 on failure).
 *
 * NOT a general-purpose WS stack: no permessage-deflate, no client side (the
 * client is Node 22's built-in WebSocket), subprotocol selection is a single
 * callback.
 *
 * Original code — written from RFC 6455, not from any library source.
 */

import { createHash } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";

const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

export const CLOSE_CODES = {
  NORMAL: 1000,
  GOING_AWAY: 1001,
  PROTOCOL_ERROR: 1002,
  UNSUPPORTED_DATA: 1003,
  INVALID_DATA: 1007,
  POLICY_VIOLATION: 1008,
  TOO_BIG: 1009,
  INTERNAL_ERROR: 1011,
  /** App-level: authentication failed or was not completed in time. */
  UNAUTHORIZED: 4401,
} as const;

const DEFAULT_MAX_MESSAGE_BYTES = 1_048_576; // 1 MiB

export function acceptWebSocketKey(key: string): string {
  return createHash("sha1").update(key + WS_GUID).digest("base64");
}

export type UpgradeCheck =
  | { ok: true; key: string; protocols: string[] }
  | { ok: false; status: number; message: string };

/** Validate an HTTP request as an RFC 6455 opening handshake. */
export function checkUpgrade(req: IncomingMessage): UpgradeCheck {
  if (req.method !== "GET") return { ok: false, status: 405, message: "method not allowed" };
  const upgrade = req.headers.upgrade?.toLowerCase();
  if (upgrade !== "websocket") return { ok: false, status: 426, message: "upgrade required" };
  const connection = (req.headers.connection ?? "").toLowerCase();
  if (!connection.split(",").map((s) => s.trim()).includes("upgrade")) {
    return { ok: false, status: 400, message: "connection must upgrade" };
  }
  const key = req.headers["sec-websocket-key"];
  if (typeof key !== "string" || key.length === 0) {
    return { ok: false, status: 400, message: "missing sec-websocket-key" };
  }
  if (req.headers["sec-websocket-version"] !== "13") {
    return { ok: false, status: 426, message: "unsupported websocket version" };
  }
  const rawProtocols = req.headers["sec-websocket-protocol"];
  const protocols =
    typeof rawProtocols === "string"
      ? rawProtocols.split(",").map((s) => s.trim()).filter((s) => s.length > 0)
      : [];
  return { ok: true, key, protocols };
}

export interface WsConnectionOptions {
  /** Refuse (1009) reassembled messages larger than this. */
  maxMessageBytes?: number;
  /** Called for each complete, UTF-8-valid text message. */
  onMessage?: (text: string) => void;
  /** Called exactly once when the connection ends (cleanly or not). */
  onClose?: (code: number, reason: string) => void;
  /** Called when a pong arrives. */
  onPong?: () => void;
}

/**
 * One accepted WebSocket connection. Owns its socket. send* are no-ops after
 * close. Server frames are never masked (RFC 6455 §5.3).
 */
export class WsConnection {
  readonly #socket: Duplex;
  readonly #maxMessageBytes: number;
  readonly #onMessage: ((text: string) => void) | undefined;
  readonly #onClose: ((code: number, reason: string) => void) | undefined;
  readonly #onPong: (() => void) | undefined;

  #recvBuf: Buffer = Buffer.alloc(0);
  /** Accumulated data-frame payloads for an in-flight fragmented message. */
  #fragments: Buffer[] | null = null;
  /** The opcode that STARTED the in-flight fragmented message (0x1 or 0x2). */
  #fragmentFirstOpcode = 0;
  #closed = false;
  #closeSent = false;

  private constructor(socket: Duplex, options: WsConnectionOptions) {
    this.#socket = socket;
    this.#maxMessageBytes = options.maxMessageBytes ?? DEFAULT_MAX_MESSAGE_BYTES;
    this.#onMessage = options.onMessage;
    this.#onClose = options.onClose;
    this.#onPong = options.onPong;
    socket.on("data", (chunk: Buffer) => this.#handleData(chunk));
    socket.on("error", () => this.#finish(CLOSE_CODES.INTERNAL_ERROR, "socket error"));
    socket.on("close", () => this.#finish(CLOSE_CODES.GOING_AWAY, "socket closed"));
  }

  get closed(): boolean {
    return this.#closed;
  }

  /**
   * Validate, write the 101 response, and wrap the socket. Returns null when
   * the handshake is invalid (an HTTP error response has been written).
   * `selectProtocol` picks at most one of the client's offered subprotocols;
   * the pick is echoed in the 101 per RFC 6455 §4.2.2.
   */
  static accept(
    req: IncomingMessage,
    socket: Duplex,
    head: Buffer,
    options: WsConnectionOptions & { selectProtocol?: (offered: string[]) => string | null },
  ): WsConnection | null {
    const check = checkUpgrade(req);
    if (!check.ok) {
      socket.write(
        `HTTP/1.1 ${check.status} Bad Request\r\nconnection: close\r\ncontent-type: text/plain\r\n\r\n${check.message}`,
      );
      socket.destroy();
      return null;
    }
    const chosen = options.selectProtocol ? options.selectProtocol(check.protocols) : null;
    const lines = [
      "HTTP/1.1 101 Switching Protocols",
      "upgrade: websocket",
      "connection: Upgrade",
      `sec-websocket-accept: ${acceptWebSocketKey(check.key)}`,
    ];
    if (chosen !== null) lines.push(`sec-websocket-protocol: ${chosen}`);
    socket.write(lines.join("\r\n") + "\r\n\r\n");
    const conn = new WsConnection(socket, options);
    if (head.length > 0) conn.#handleData(head);
    return conn;
  }

  sendText(text: string): void {
    if (this.#closed) return;
    this.#socket.write(encodeFrame(0x1, Buffer.from(text, "utf8")));
  }

  sendJson(value: unknown): void {
    this.sendText(JSON.stringify(value));
  }

  ping(payload = ""): void {
    if (this.#closed) return;
    this.#socket.write(encodeFrame(0x9, Buffer.from(payload, "utf8")));
  }

  /** Start the closing handshake; the socket ends after the peer echoes. */
  close(code: number = CLOSE_CODES.NORMAL, reason = ""): void {
    if (this.#closed) return;
    if (!this.#closeSent) {
      this.#closeSent = true;
      const reasonBuf = Buffer.from(reason, "utf8");
      const payload = Buffer.alloc(2 + reasonBuf.length);
      payload.writeUInt16BE(code, 0);
      reasonBuf.copy(payload, 2);
      this.#socket.write(encodeFrame(0x8, payload));
    }
    this.#socket.end();
  }

  /** Force-drop without the closing handshake (abuse/timeout paths). */
  terminate(): void {
    if (this.#closed) return;
    this.#socket.destroy();
    this.#finish(CLOSE_CODES.GOING_AWAY, "terminated");
  }

  #finish(code: number, reason: string): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#onClose?.(code, reason);
  }

  #handleData(chunk: Buffer): void {
    if (this.#closed) return;
    this.#recvBuf = this.#recvBuf.length === 0 ? chunk : Buffer.concat([this.#recvBuf, chunk]);
    for (;;) {
      const frame = decodeFrame(this.#recvBuf, this.#maxMessageBytes);
      if (frame.kind === "incomplete") return;
      if (frame.kind === "error") {
        this.close(frame.code, frame.reason);
        return;
      }
      this.#recvBuf = this.#recvBuf.subarray(frame.bytesConsumed);
      if (!this.#dispatchFrame(frame.fin, frame.opcode, frame.payload)) return;
    }
  }

  /** Returns false when the connection is closing/closed. */
  #dispatchFrame(fin: boolean, opcode: number, payload: Buffer): boolean {
    switch (opcode) {
      case 0x8: {
        // close: payload = [code][reason] — echo and end.
        let code: number = CLOSE_CODES.NORMAL;
        let reason = "";
        if (payload.length >= 2) {
          code = payload.readUInt16BE(0);
          reason = payload.subarray(2).toString("utf8");
        }
        this.close(code, reason);
        return false;
      }
      case 0x9: // ping -> pong
        this.#socket.write(encodeFrame(0xA, payload));
        return true;
      case 0xA: // pong
        this.#onPong?.();
        return true;
      case 0x0: // continuation
      case 0x1: // text
      case 0x2: { // binary (refused at delivery; still tracked for framing)
        if (opcode === 0x1 && this.#fragments !== null) {
          this.close(CLOSE_CODES.PROTOCOL_ERROR, "new message before finishing fragmented one");
          return false;
        }
        if (opcode === 0x0 && this.#fragments === null) {
          this.close(CLOSE_CODES.PROTOCOL_ERROR, "unexpected continuation");
          return false;
        }
        if (opcode !== 0x0) this.#fragmentFirstOpcode = opcode;
        this.#fragments = [...(this.#fragments ?? []), payload];
        const total = this.#fragments.reduce((n, b) => n + b.length, 0);
        if (total > this.#maxMessageBytes) {
          this.close(CLOSE_CODES.TOO_BIG, "message too large");
          return false;
        }
        if (!fin) return true; // wait for the rest of the fragments
        const isBinary = this.#fragmentOpcodeIsBinary();
        const assembled = Buffer.concat(this.#fragments);
        this.#fragments = null;
        if (isBinary) {
          this.close(CLOSE_CODES.UNSUPPORTED_DATA, "text only");
          return false;
        }
        const text = utf8Strict(assembled);
        if (text === null) {
          this.close(CLOSE_CODES.INVALID_DATA, "invalid utf-8");
          return false;
        }
        this.#onMessage?.(text);
        return true;
      }
      default:
        this.close(CLOSE_CODES.PROTOCOL_ERROR, `unknown opcode ${opcode}`);
        return false;
    }
  }

  // The first fragment's opcode decides the message type; we only push frames
  // after validating sequence, so fragments[0] always exists when in-flight.
  #fragmentOpcodeIsBinary(): boolean {
    return this.#fragmentFirstOpcode === 0x2;
  }
}

type DecodedFrame =
  | { kind: "incomplete" }
  | { kind: "error"; code: number; reason: string }
  | { kind: "frame"; bytesConsumed: number; fin: boolean; opcode: number; payload: Buffer };

/** Parse one frame from the front of `buf`. */
function decodeFrame(buf: Buffer, maxMessageBytes: number): DecodedFrame {
  if (buf.length < 2) return { kind: "incomplete" };
  const b0 = buf[0]!;
  const b1 = buf[1]!;
  const fin = (b0 & 0x80) !== 0;
  const opcode = b0 & 0x0f;
  const masked = (b1 & 0x80) !== 0;
  let length = b1 & 0x7f;
  let offset = 2;

  if (length === 126) {
    if (buf.length < offset + 2) return { kind: "incomplete" };
    length = buf.readUInt16BE(offset);
    offset += 2;
  } else if (length === 127) {
    if (buf.length < offset + 8) return { kind: "incomplete" };
    const big = buf.readBigUInt64BE(offset);
    offset += 8;
    if (big > BigInt(maxMessageBytes)) {
      return { kind: "error", code: CLOSE_CODES.TOO_BIG, reason: "frame too large" };
    }
    length = Number(big);
  }
  if (length > maxMessageBytes) {
    return { kind: "error", code: CLOSE_CODES.TOO_BIG, reason: "frame too large" };
  }

  if (!masked) {
    // RFC 6455 §5.3: the server MUST close on an unmasked client frame.
    return { kind: "error", code: CLOSE_CODES.PROTOCOL_ERROR, reason: "client frames must be masked" };
  }
  if (buf.length < offset + 4) return { kind: "incomplete" };
  const maskKey = buf.subarray(offset, offset + 4);
  offset += 4;

  if (buf.length < offset + length) return { kind: "incomplete" };
  const payload = Buffer.from(buf.subarray(offset, offset + length));
  for (let i = 0; i < payload.length; i++) payload[i] = payload[i]! ^ maskKey[i % 4]!;

  // Control frames: FIN required, payload ≤ 125 (RFC 6455 §5.5).
  if (opcode >= 0x8 && (!fin || length > 125)) {
    return { kind: "error", code: CLOSE_CODES.PROTOCOL_ERROR, reason: "bad control frame" };
  }

  return { kind: "frame", bytesConsumed: offset + length, fin, opcode, payload };
}

/** Server → client frame: FIN set, never masked. */
function encodeFrame(opcode: number, payload: Buffer): Buffer {
  const length = payload.length;
  let header: Buffer;
  if (length < 126) {
    header = Buffer.alloc(2);
    header[1] = length;
  } else if (length < 65536) {
    header = Buffer.alloc(4);
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(10);
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }
  header[0] = 0x80 | opcode;
  return Buffer.concat([header, payload]);
}

/** Strict UTF-8: returns null on malformed input (for a 1007 close). */
function utf8Strict(buf: Buffer): string | null {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    return null;
  }
}

