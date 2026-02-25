import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Create Account',
  description: 'Create a Spokio account to start IELTS preparation on web and mobile.',
  alternates: {
    canonical: '/register'
  },
  robots: {
    index: false,
    follow: false
  }
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}

