/**
 * codingAgentSettingsShim — clean reimplementation of the re-export shim
 * `CodingAgentSettingsPage.C73HMBrM.js` (matrix §F "Coding agent settings"
 * row, second chunk). Original code; verified against the committed
 * corpus-executed golden (`golden/coding-agent-settings-shim.expected.json`).
 *
 * The corpus shim's entire behavior is its alias map (hand-verified, the
 * chunk is two lines): `import{n,r,t} from ./CodingAgentSettingsPage.lcMyXnM7`
 * re-exported as `Component` (n), `pageMetadata` (r), and
 * `CodingAgentSettingsContent` (t). The golden pins the public export-name
 * surface and byte-matches the surfaced pageMetadata against the G20 golden's
 * metadata region; this module surfaces OUR golden-backed metadata builder
 * under the shim's public name, mirroring the aliasing (the component
 * aliases' targets are declared GAP and have no reimplementation to surface).
 */

export { codingAgentSettingsMetadata as pageMetadata } from "./coding-agent-settings-metadata.ts";
