// Hand-written stub for ContextualMenuActions.Dlg9Oa2U.js (G34 case; original
// code). The entry consumes exactly one member, `jR` — the suspense useQuery
// wrapper (raw source: `CRe as jR`; CRe(e,t) => suspense query returning
// {data}). The stub RECORDS the query descriptor the entry built (queryKey
// bytes; queryFn is invoked ONCE by the driver-controlled recorder to pin the
// Issue-seam call it closes over) and returns the scripted {data} fixture the
// driver installed. Any other member read throws loudly.
let scripted = null;
export const queries = [];
export const setQueryData = (data) => { scripted = data; };
export const jR = (descriptor) => {
  if (scripted === null) throw new Error(`G34 stub: jR called before the driver scripted query data`);
  queries.push(descriptor);
  return { data: scripted };
};
