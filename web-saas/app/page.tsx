export default function HomePage() {
  return (
    <section>
      <h1>Complete IELTS SaaS platform with preserved speaking core</h1>
      <p className="subtitle">
        Spokio Web SaaS delivers Speaking, Writing, Reading, and Listening in one cross-platform experience while
        preserving existing speaking services and API contracts.
      </p>
      <div className="cta-row">
        <a className="btn btn-primary" href="/app/dashboard">
          Open Learner App
        </a>
        <a className="btn btn-secondary" href="/admin/overview">
          Open Admin Suite
        </a>
      </div>
      <div className="grid-3" style={{ marginTop: '1rem' }}>
        <article className="panel">
          <h3>Speaking-safe rollout</h3>
          <p>Existing speaking endpoints remain unchanged. Web parity is additive with browser recording and TTS.</p>
        </article>
        <article className="panel">
          <h3>All IELTS modules</h3>
          <p>Practice and full mock journeys across Writing, Reading, Listening, and Speaking with shared progress.</p>
        </article>
        <article className="panel">
          <h3>Admin operations</h3>
          <p>RBAC, content operations, feature flags, and AI usage observability designed for phased production rollout.</p>
        </article>
      </div>
    </section>
  );
}
