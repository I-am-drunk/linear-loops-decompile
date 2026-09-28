// driver that loads by an ambiguous prefix — must throw, never first-match.
export default async function drive({ load }) {
  return load(`math`);
}
