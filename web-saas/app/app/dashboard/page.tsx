export default function DashboardPage() {
  return (
    <section>
      <h1>Learner Dashboard</h1>
      <p className="subtitle">Your cross-module progress, next recommended tasks, and subscription usage.</p>
      <div className="grid-3">
        <article className="panel">
          <p>Current track</p>
          <p className="kpi">Academic + General</p>
        </article>
        <article className="panel">
          <p>Speaking status</p>
          <p className="kpi">Parity-enabled</p>
        </article>
        <article className="panel">
          <p>Rollout mode</p>
          <p className="kpi">Feature-flagged</p>
        </article>
      </div>
    </section>
  );
}
