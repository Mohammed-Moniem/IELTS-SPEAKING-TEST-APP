const cards = [
  ['Speaking', 'Browser recording, transcription, evaluator flow, and robust fallback for mic-denied states.'],
  ['Writing', 'Prompt generation, scored submissions, rubric breakdown, and history endpoints.'],
  ['Reading', 'Practice/full mocks with objective scoring and normalized band feedback.'],
  ['Listening', 'Audio-aware test flow with transcript metadata and objective scoring.'],
  ['Full Exams', 'Section orchestration and consolidated results under one exam session.'],
  ['Admin Suite', 'Role-gated content ops, user/subscription support, analytics, AI cost, and feature flags.']
] as const;

export default function FeaturesPage() {
  return (
    <section className="section-wrap">
      <div className="panel hero-panel stack">
        <h1>Feature-complete IELTS SaaS architecture</h1>
        <p className="subtitle">
          Academic + General tracks, shared identity/subscription model, additive backend expansion, and staged release controls.
        </p>
      </div>
      <div className="grid-3">
        {cards.map(([title, copy]) => (
          <article key={title} className="panel stack">
            <h3>{title}</h3>
            <p className="subtitle">{copy}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
