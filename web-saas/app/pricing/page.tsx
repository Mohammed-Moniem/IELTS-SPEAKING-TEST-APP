const plans = [
  { name: 'Free', price: '$0', features: ['Core access', 'Monthly limits', 'Email/password login'] },
  { name: 'Premium', price: '$9.99', features: ['Higher limits', 'Advanced feedback', 'Priority processing'] },
  { name: 'Pro', price: '$19.99', features: ['Maximum limits', 'Detailed reports', 'Admin-ready org setup'] }
];

export default function PricingPage() {
  return (
    <section>
      <h1>Pricing</h1>
      <div className="grid-3">
        {plans.map(plan => (
          <article key={plan.name} className="panel">
            <h3>{plan.name}</h3>
            <p className="kpi">{plan.price}</p>
            <ul>
              {plan.features.map(feature => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
