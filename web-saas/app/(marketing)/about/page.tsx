export default function AboutPage() {
  return (
    <section className="section-wrap">
      <div className="panel hero-panel stack">
        <h1>About Spokio</h1>
        <p className="subtitle">
          Spokio is focused on practical IELTS outcomes: realistic tests, reliable scoring, and product architecture that
          protects compatibility while shipping fast.
        </p>
      </div>
      <div className="panel stack">
        <h3>V1 Boundaries</h3>
        <p className="subtitle">
          English-only UI, email/password auth, AI scoring guardrails, and a strict phased rollout with feature flags.
        </p>
      </div>
    </section>
  );
}
