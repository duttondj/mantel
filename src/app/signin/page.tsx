import SignInForm from './SignInForm';

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const { mode } = await searchParams;
  return <SignInForm initialMode={mode === 'signup' ? 'signup' : 'signin'} />;
}
