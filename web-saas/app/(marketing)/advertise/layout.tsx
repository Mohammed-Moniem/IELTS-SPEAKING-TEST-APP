import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Advertise',
  description:
    'Reach 38K+ active IELTS learners with sponsored placements on Spokio. Choose from module side panels, homepage sponsor cards, blog blocks, newsletter slots, and partner spotlights.',
  alternates: {
    canonical: '/advertise'
  },
  openGraph: {
    title: 'Advertise on Spokio | IELTS Sponsorship Packages',
    description:
      'Reach 38K+ active IELTS learners with policy-reviewed sponsored placements. Monthly, quarterly, and annual packages starting at $149/month.',
    url: '/advertise'
  }
};

export default function AdvertiseLayout({ children }: { children: React.ReactNode }) {
  return children;
}
