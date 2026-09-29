// Hand-written stub for Integration.B02xjlHD.js (G17 case; original code).
// `l` (the Integration service enum object; the component body reads
// l.mcpServer) is touched only inside the component body; a throwing Proxy
// keeps any read loud.
export const l = new Proxy({}, {
  get(_t, key) {
    throw new Error(`G17 stub: Integration.l.${String(key)} read — no render in this case`);
  },
});
