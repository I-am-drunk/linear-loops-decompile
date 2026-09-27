export function StubPage(props: { title: string; note: string }) {
  return (
    <div className="page">
      <h1>{props.title}</h1>
      <div className="empty">
        <h2>Not built yet</h2>
        <p>{props.note}</p>
      </div>
    </div>
  );
}
