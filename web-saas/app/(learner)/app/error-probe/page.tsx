import { notFound } from 'next/navigation';

import ErrorProbeClient from './ErrorProbeClient';

export default function ErrorProbePage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  return <ErrorProbeClient />;
}
