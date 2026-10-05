/** MCP1: the destination-safety kernel. Pure; no resolver, no network. */

import assert from "node:assert/strict";
import { test } from "node:test";
import { checkDestination, isForbiddenAddress } from "./destination.ts";
import type { McpServerAuth } from "./types.ts";

const NONE: McpServerAuth = { kind: `none` };
const BEARER: McpServerAuth = { kind: `bearer` };

const refused = (url: string, auth: McpServerAuth, policy?: Parameters<typeof checkDestination>[2]) => {
  const v = checkDestination(url, auth, policy);
  assert.equal(v.ok, false, `expected refusal for ${url}`);
  return v.ok ? undefined : v;
};

test(`a public https destination with credentials is fine`, () => {
  assert.deepEqual(checkDestination(`https://mcp.example.com/sse`, BEARER), { ok: true });
});

test(`credentials over http are REFUSED, not warned about`, () => {
  const v = refused(`http://mcp.example.com`, BEARER);
  assert.equal(v?.reason, `cleartextCredentials`);
  // header and oauth2 count as credentials too
  assert.equal(refused(`http://x.example.com`, { kind: `header`, name: `x-key` })?.reason, `cleartextCredentials`);
  assert.equal(refused(`http://x.example.com`, { kind: `oauth2`, scopes: [] })?.reason, `cleartextCredentials`);
});

test(`private and special IPv4 ranges are refused by default, each named`, () => {
  const cases: [string, RegExp][] = [
    [`https://127.0.0.1/`, /loopback/],
    [`https://10.0.0.5/`, /rfc1918/],
    [`https://172.16.0.1/`, /rfc1918/],
    [`https://192.168.1.1/`, /rfc1918/],
    [`https://169.254.169.254/latest/meta-data`, /cloud metadata/],
    [`https://100.64.0.1/`, /cgnat/],
    [`https://224.0.0.1/`, /multicast/],
  ];
  for (const [url, why] of cases) {
    const v = refused(url, NONE);
    assert.equal(v?.reason, `forbiddenRange`, url);
    assert.match(v?.detail ?? ``, why, url);
  }
});

test(`172.15 and 172.32 are public — the /12 boundary is exact`, () => {
  assert.equal(checkDestination(`https://172.15.0.1/`, NONE).ok, true);
  assert.equal(checkDestination(`https://172.32.0.1/`, NONE).ok, true);
  assert.equal(isForbiddenAddress(`172.31.255.255`), `rfc1918`);
});

test(`IPv6: loopback, link-local, ULA and multicast are refused; global unicast passes`, () => {
  assert.equal(refused(`https://[::1]/`, NONE)?.detail, `::1 is loopback`);
  assert.match(refused(`https://[fe80::1]/`, NONE)?.detail ?? ``, /link-local/);
  assert.match(refused(`https://[fd00::1]/`, NONE)?.detail ?? ``, /unique-local/);
  assert.match(refused(`https://[ff02::1]/`, NONE)?.detail ?? ``, /multicast/);
  assert.equal(checkDestination(`https://[2606:4700::1111]/`, NONE).ok, true);
});

test(`IPv4-mapped IPv6 is decoded — WHATWG canonicalizes it to hex, which hid RFC1918`, () => {
  // `new URL("https://[::ffff:192.168.1.1]/").hostname` is `[::ffff:c0a8:101]`.
  // A dotted-quad regex never fired on that; the smoke run caught a mapped
  // private address passing as public. The hextets must be decoded.
  assert.match(refused(`https://[::ffff:192.168.1.1]/`, NONE)?.detail ?? ``, /rfc1918/);
  assert.match(refused(`https://[::ffff:169.254.169.254]/`, NONE)?.detail ?? ``, /cloud metadata/);
  assert.equal(checkDestination(`https://[::ffff:8.8.8.8]/`, NONE).ok, true);
});

test(`loopback exception is OPT-IN, and only for unauthenticated http`, () => {
  assert.equal(refused(`http://localhost:3000/`, NONE)?.reason, `forbiddenRange`, `default must refuse`);
  assert.equal(checkDestination(`http://localhost:3000/`, NONE, { allowLoopback: true }).ok, true);
  assert.equal(checkDestination(`http://127.0.0.1:3000/`, NONE, { allowLoopback: true }).ok, true);
  // Opting in does NOT loosen the credential rule. Loopback is the most
  // valuable SSRF target, so the exception stays as narrow as possible.
  assert.equal(refused(`http://localhost:3000/`, BEARER, { allowLoopback: true })?.reason, `cleartextCredentials`);
});

test(`an explicit host allowlist overrides the range rule, exact and lowercase`, () => {
  assert.equal(checkDestination(`https://10.0.0.5/`, BEARER, { allowHosts: [`10.0.0.5`] }).ok, true);
  assert.equal(checkDestination(`https://Internal.Corp/`, BEARER, { allowHosts: [`internal.corp`] }).ok, true);
  // allowlisting one host does not allowlist its neighbours
  assert.equal(refused(`https://10.0.0.6/`, BEARER, { allowHosts: [`10.0.0.5`] })?.reason, `forbiddenRange`);
});

test(`the allowlist does not override the cleartext rule`, () => {
  // Allowing a host says "you may reach it", not "you may leak a token to it".
  assert.equal(refused(`http://10.0.0.5/`, BEARER, { allowHosts: [`10.0.0.5`] })?.reason, `cleartextCredentials`);
});

test(`when both faults apply, the credential exposure is the one reported`, () => {
  // http + bearer + private range: cleartext is the more severe fault.
  assert.equal(refused(`http://10.0.0.5/`, BEARER)?.reason, `cleartextCredentials`);
});

test(`garbage and non-http schemes are refused with their own reasons`, () => {
  assert.equal(refused(`not a url`, NONE)?.reason, `badUrl`);
  assert.equal(refused(`ftp://files.example.com/`, NONE)?.reason, `badScheme`);
  assert.equal(refused(`file:///etc/passwd`, NONE)?.reason, `badScheme`);
});

test(`isForbiddenAddress is exported for MCP2 to re-check every resolved address`, () => {
  // Validating a hostname and then connecting by name re-resolves and loses
  // the check (DNS rebinding). MCP2 must call this on the address it connects to.
  assert.equal(isForbiddenAddress(`169.254.169.254`), `link-local (cloud metadata)`);
  assert.equal(isForbiddenAddress(`93.184.216.34`), undefined);
});

// --- bypass regressions (CodeRabbit inline review + variant probe) --------
// Each host below reaches loopback, this-network or RFC1918 and was ALLOWED
// before this fix. The method that found them: probe VARIANTS of a host the
// guard already blocks, not more examples of what it was written for.

test(`the .localhost tree is loopback, per RFC 6761`, () => {
  // getent hosts foo.localhost -> ::1
  for (const h of [`localhost`, `LOCALHOST`, `localhost.`, `foo.localhost`, `a.b.localhost`]) {
    assert.equal(isForbiddenAddress(h), `loopback`, h);
  }
});

test(`non-canonical numeric host forms are refused, not decoded`, () => {
  // All four are accepted as 127.0.0.1 by inet_aton-style parsers and by
  // browsers. Refusing the FORM is smaller to reason about than decoding it.
  for (const h of [`127.1`, `0x7f000001`, `2130706433`, `0`]) {
    assert.equal(isForbiddenAddress(h), `non-canonical address form`, h);
  }
});

test(`expanded and mapped IPv6 spellings are canonicalized first`, () => {
  // forbiddenV6 compares against `::1` and a hex-tail mapped form, so these
  // two spellings missed. checkDestination only caught the mapped one
  // because url.hostname had already rewritten it -- a DIRECT caller, which
  // MCP2 is instructed to be, got no such help.
  assert.equal(isForbiddenAddress(`0:0:0:0:0:0:0:1`), `loopback`);
  assert.equal(isForbiddenAddress(`::ffff:10.0.0.1`), `rfc1918`);
  assert.equal(isForbiddenAddress(`::ffff:a00:1`), `rfc1918`);
});

test(`legitimate public hosts are still allowed`, () => {
  // The direction that breaks deployments. `0xygen` and `123abc` are the
  // cases that matter: the non-canonical-numeric pattern must be anchored so
  // it cannot swallow a hostname that merely STARTS with 0x or digits.
  for (const h of [
    `mcp.example.com`,
    `api.githubusercontent.com`,
    `a1.example.co.uk`,
    `8.8.8.8`,
    `203.0.113.7`,
    `2606:4700::1111`,
    `my-server.internal.example.com`,
    `0xygen.example.com`,
    `123abc.example.com`,
  ]) {
    assert.equal(isForbiddenAddress(h), undefined, h);
  }
});

test(`a bearer-authed .localhost URL is refused end to end`, () => {
  const v = checkDestination(`https://foo.localhost/mcp`, { kind: `bearer` }, {});
  assert.equal(v.ok, false);
  assert.equal(v.ok === false && v.reason, `forbiddenRange`);
});
