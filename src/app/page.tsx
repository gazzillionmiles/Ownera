import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import PublicLandingPage from '@/src/shared/components/PublicLandingPage';

export default async function Page() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect('/home');
  }

  return <PublicLandingPage />;
}
