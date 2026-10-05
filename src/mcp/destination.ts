/**
 * Destination safety for remote MCP servers (MCP1, docs/plan/mcp.md).
 *
 * The runner sits inside the deployment's network and fires on a schedule
 * with nobody watching, so a configurable URL it will fetch is an SSRF
 * primitive. Two rules, both pure and testable here, enforced before any
 * connection code exists:
 *
 *   1. Never send credentials in cleartext: auth beyond `none` requires
 *      https. The runner REFUSES rather than warns.
 *   2. Destinations are deny-by-default: public unicast only. Private and
 *      special ranges are refused unless the deployment allowlists a host.
 *
 * This file checks the URL as WRITTEN. Resolving the hostname and checking
 * the resulting address — the DNS-rebinding half — needs a resolver and
 * belongs to MCP2, which must call back into `isForbiddenAddress` for every
 * address it actually connects to.
 */

import type { McpServerAuth } from "./types.ts";

export type DestinationPolicy = {
  /** Hostnames the deployment has explicitly permitted (exact, lowercase). */
  allowHosts?: readonly string[];
  /** Opt-in: permit unauthenticated http to loopback for local dev. */
  allowLoopback?: boolean;
};

export type DestinationVerdict =
  | { ok: true }
  | { ok: false; reason: `cleartextCredentials` | `forbiddenRange` | `badUrl` | `badScheme`; detail: string };

/** Parse dotted-quad into four octets, or undefined if it is not one. */
function v4(host: string): [number, number, number, number] | undefined {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return undefined;
  const o = m.slice(1).map(Number) as [number, number, number, number];
  return o.every((n) => n <= 255) ? o : undefined;
}

/**
 * Private and special IPv4 ranges, deny-by-default. Each is named because a
 * reviewer should be able to check the list against the plan without
 * decoding masks: 169.254/16 is the one that reaches cloud metadata.
 */
function forbiddenV4([a, b]: [number, number, number, number]): string | undefined {
  if (a === 127) return `loopback`;
  if (a === 10) return `rfc1918`;
  if (a === 172 && b >= 16 && b <= 31) return `rfc1918`;
  if (a === 192 && b === 168) return `rfc1918`;
  if (a === 169 && b === 254) return `link-local (cloud metadata)`;
  if (a === 100 && b >= 64 && b <= 127) return `cgnat`;
  if (a === 0) return `this-network`;
  if (a >= 224) return a >= 240 ? `reserved` : `multicast`;
  return undefined;
}

/**
 * IPv6 equivalents. Receives a bare address — the caller strips the
 * brackets WHATWG URL leaves on `.hostname`. Only the prefixes the
 * plan names; an unrecognized v6 literal is treated as public, which is the
 * deny-by-default rule's one deliberate gap and is noted in the tests.
 */
function forbiddenV6(host: string): string | undefined {
  const h = host.toLowerCase();
  if (h === `::1` || h === `::`) return `loopback`;
  if (h.startsWith(`fe80:`)) return `link-local`;
  if (h.startsWith(`fc`) || h.startsWith(`fd`)) return `unique-local (rfc4193)`;
  if (h.startsWith(`ff`)) return `multicast`;
  // IPv4-mapped. WHATWG URL canonicalizes `::ffff:192.168.1.1` to the HEX
  // form `::ffff:c0a8:101`, so a dotted-quad regex here never fires — the
  // smoke run showed a mapped RFC1918 address passing as public. Decode the
  // two hextets back into octets and check those.
  const mapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(h);
  if (mapped?.[1] && mapped[2]) {
    const hi = Number.parseInt(mapped[1], 16);
    const lo = Number.parseInt(mapped[2], 16);
    return forbiddenV4([hi >> 8, hi & 255, lo >> 8, lo & 255]);
  }
  return undefined;
}

/** Is this literal address one the runner must never be pointed at? */
function nonCanonicalNumeric(host: string): boolean {
  return /^(0x[\da-f]+|\d+|\d{1,3}(\.\d{1,3}){1,2})$/i.test(host);
}


/**
 * Canonicalize an IPv6 literal via the WHATWG URL parser, which compresses
 * `0:0:0:0:0:0:0:1` to `::1` and rewrites a mapped dotted-quad tail to hex.
 * checkDestination got this for free from url.hostname; a DIRECT caller --
 * which MCP2 is instructed to be -- did not, so do it here.
 */
function canonicalV6(host: string): string {
  try {
    return new URL(`https://[${host}]/`).hostname.replace(/^\[|\]$/g, ``);
  } catch {
    return host;
  }
}

export function isForbiddenAddress(host: string): string | undefined {
  const h = host.toLowerCase().replace(/\.$/, ``);
  if (nonCanonicalNumeric(h)) return `non-canonical address form`;
  const q = v4(h);
  if (q) return forbiddenV4(q);
  if (h.includes(`:`)) return forbiddenV6(canonicalV6(h));
  if (h === `localhost` || h.endsWith(`.localhost`)) return `loopback`;
  return undefined;
}

/**
 * Check a remote server URL as written, under a deployment policy.
 *
 * Order matters: the cleartext rule is checked before the range rule so that
 * `http://10.0.0.5` with a bearer token reports the credential exposure, the
 * more severe of its two faults.
 */
export function checkDestination(
  rawUrl: string,
  auth: McpServerAuth,
  policy: DestinationPolicy = {},
): DestinationVerdict {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: `badUrl`, detail: rawUrl };
  }
  if (url.protocol !== `https:` && url.protocol !== `http:`) {
    return { ok: false, reason: `badScheme`, detail: url.protocol };
  }
  // WHATWG URL keeps the brackets on an IPv6 hostname (`[::1]`), so strip
  // them or forbiddenV6 never sees a bare address. The smoke run caught
  // `https://[::1]/` passing as public because of exactly this.
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, ``);
  const authed = auth.kind !== `none`;

  if (url.protocol === `http:` && authed) {
    return { ok: false, reason: `cleartextCredentials`, detail: `${auth.kind} over http to ${host}` };
  }
  if (policy.allowHosts?.includes(host)) return { ok: true };

  const range = isForbiddenAddress(host);
  if (range === undefined) return { ok: true };
  // The ONE exception: unauthenticated http to loopback, and only when the
  // deployment opted in. Loopback is the most valuable SSRF target.
  if (range === `loopback` && !authed && url.protocol === `http:` && policy.allowLoopback) return { ok: true };
  return { ok: false, reason: `forbiddenRange`, detail: `${host} is ${range}` };
}
