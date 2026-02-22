export default function AdminOverviewPage() {
  return (
    <section>
      <h1>Admin Overview</h1>
      <p className="subtitle">Superadmin operations, analytics, and feature rollout control center.</p>
      <div className="grid-3">
        <article className="panel">
          <h3>Content</h3>
          <p>Manage writing/reading/listening content.</p>
        </article>
        <article className="panel">
          <h3>AI Usage</h3>
          <p>Monitor request volume, token spend, and cache hit rate.</p>
        </article>
        <article className="panel">
          <h3>Feature Flags</h3>
          <p>Enable phased rollout by module and surface.</p>
        </article>
      </div>
    </section>
  );
}
