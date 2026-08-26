export function App(): React.JSX.Element {
  return (
    <div className="app-shell">
      <header className="app-toolbar">
        <strong className="app-name">浮现</strong>
      </header>
      <main className="document-surface" aria-label="Document preview" />
    </div>
  );
}
