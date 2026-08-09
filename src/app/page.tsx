import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: setup } = await supabase
    .from('app_setup')
    .select('admin_created')
    .limit(1)
    .maybeSingle();

  if (!user) {
    redirect(setup?.admin_created ? '/login' : '/setup');
  }

  redirect('/dashboard');
}