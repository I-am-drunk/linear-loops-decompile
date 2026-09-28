// driver: call the fixture add twice, feed the first result to the second —
// the multi-step setup JSON args cannot express (#225 red-team R2-2).
export default async function drive({ entry }) {
  const first = entry.n(1, 2); // {sum: 6, parts:[1,2]}
  const second = entry.n(first.sum, 4); // {sum: 20, parts:[6,4]}
  return { first, second };
}
