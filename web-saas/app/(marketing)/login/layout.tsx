import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Login',
  description: 'Sign in to your Spokio account.',
  alternates: {
    canonical: '/login'
  },
  robots: {
    index: false,
    follow: false
  }
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}

