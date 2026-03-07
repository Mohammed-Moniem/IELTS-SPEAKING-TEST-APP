import { LoginPageContent } from '@/components/auth/LoginPageContent';

type LoginPageProps = {
  searchParams: Promise<{ next?: string | string[] }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = await searchParams;
  const nextValue = resolvedSearchParams.next;
  const nextParam = Array.isArray(nextValue) ? (nextValue[0] ?? '') : (nextValue ?? '');

  return <LoginPageContent nextParam={nextParam} />;
}
