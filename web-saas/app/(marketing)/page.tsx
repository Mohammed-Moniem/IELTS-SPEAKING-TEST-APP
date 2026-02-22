import Link from 'next/link';

const pillars = [
  {
    title: 'Speaking-safe by contract',
    body: 'Existing speaking routes and semantics remain untouched. Web parity uses additive integration only.'
  },
  {
    title: 'Complete IELTS stack',
    body: 'Writing, Reading, Listening, and full exam orchestration with shared progress and billing across web + mobile.'
  },
  {
    title: 'Admin rollout control',
    body: 'RBAC, feature flags, AI cost visibility, and audit logs allow staged releases without operational risk.'
  }
];

export default function HomePage() {
  return (
    <section className="section-wrap">
      <div className="panel hero-panel stack">
        <span className="tag">Web SaaS Expansion</span>
        <h1>One IELTS platform, zero speaking regressions.</h1>
        <p className="subtitle">
          Spokio Web SaaS delivers a premium learner experience across all IELTS modules while preserving your current
          speaking contracts for mobile and existing API clients.
        </p>
        <div className="cta-row">
          <Link className="btn btn-primary" href="/register">
            Start Free
          </Link>
          <Link className="btn btn-secondary" href="/app/dashboard">
            Open Learner App
          </Link>
          <Link className="btn btn-secondary" href="/admin/overview">
            Open Admin Suite
          </Link>
        </div>
      </div>

      <div className="grid-3">
        {pillars.map(item => (
          <article key={item.title} className="panel stack">
            <h3>{item.title}</h3>
            <p className="subtitle">{item.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
