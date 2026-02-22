import Link from 'next/link';

const plans = [
  {
    name: 'Free',
    price: '$0',
    note: 'Ideal for onboarding and baseline practice',
    bullets: ['Email/password auth', 'Monthly module limits', 'Core feedback and progress views']
  },
  {
    name: 'Premium',
    price: '$9.99',
    note: 'Higher limits and stronger evaluator depth',
    bullets: ['Expanded practice volume', 'Detailed writing/objective feedback', 'Priority AI routing']
  },
  {
    name: 'Pro',
    price: '$19.99',
    note: 'Maximum throughput and operational insight',
    bullets: ['Maximum quotas', 'Advanced reports', 'Best-fit for serious prep and admin support flows']
  }
];

export default function PricingPage() {
  return (
    <section className="section-wrap">
      <div className="panel hero-panel stack">
        <h1>Pricing built for phased IELTS growth</h1>
        <p className="subtitle">Keep your existing Free/Premium/Pro baseline and Stripe flow, now with complete module coverage.</p>
      </div>
      <div className="grid-3">
        {plans.map(plan => (
          <article key={plan.name} className="panel stack">
            <h3>{plan.name}</h3>
            <p className="kpi">{plan.price}</p>
            <p className="small">{plan.note}</p>
            <ul>
              {plan.bullets.map(item => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <Link href="/register" className="btn btn-primary" style={{ width: 'fit-content' }}>
              Choose {plan.name}
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
