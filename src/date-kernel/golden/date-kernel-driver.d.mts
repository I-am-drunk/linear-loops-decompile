// Type surface of the golden driver (hand-written; the driver stays plain
// ESM so corpus-exec can import it unchanged).
declare const drive: (s: { entry: Record<string, unknown> }) => Promise<unknown>;
export default drive;
