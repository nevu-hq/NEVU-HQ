import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ShieldCheck, Activity, WalletCards, Clock3, ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/layout/AppShell';
import { WelcomePanel } from '@/components/layout/WelcomePanel';
import { AgentGrid } from '@/components/ai/AgentGrid';

export default async function Holding() {
  const sb = await createClient();
  
  const { data: { user }, error: authError } = await sb.auth.getUser();
  if (authError || !user) {
    redirect('/login');
  }

  const [adminRes, holdingRes] = await Promise.all([
    sb.from('nevu_administrators').select('*').eq('id', user.id).maybeSingle(),
    sb.from('holdings').select('*').eq('administrator_id', user.id).maybeSingle(),
  ]);

  const admin = adminRes.data;
  if (admin && !admin.setup_complete) {
    redirect('/verify');
  }

  const holding = holdingRes.data;

  const presenceRes = holding 
    ? await sb.from('nevu_presence').select('*').eq('user_id', user.id).maybeSingle() 
    : { data: null };

  const presence = presenceRes.data;

  const username = admin?.username || 'Administrator';
  const holdingName = holding?.holding_name || 'Your Holding';

  return (
    <AppShell username={username} holdingName={holdingName}>
      <div className="space-y-5">
        <WelcomePanel username={username} holding={holdingName} />
        <div className="grid gap-4 md:grid-cols-4">
          <div className="card p-4">
            <ShieldCheck size={18} />
            <div className="text-xs muted mt-3">Security</div>
            <div className="font-medium mt-1">Protected</div>
          </div>
          <div className="card p-4">
            <Activity size={18} />
            <div className="text-xs muted mt-3">Personal AI</div>
            <div className="font-medium mt-1">{presence?.personal_ai_present ? '● Active' : '○ Inactive'}</div>
          </div>
          <div className="card p-4">
            <WalletCards size={18} />
            <div className="text-xs muted mt-3">Base currency</div>
            <div className="font-medium mt-1">{holding?.base_currency || 'NGN'}</div>
          </div>
          <div className="card p-4">
            <Clock3 size={18} />
            <div className="text-xs muted mt-3">NEVU code</div>
            <div className="font-medium mt-1 tracking-widest">{holding?.nevu_code || '—'}</div>
          </div>
        </div>
        <section className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-lg font-semibold">Specialist Council</div>
              <div className="text-sm muted">Nine distinct roles. Separate outputs.</div>
            </div>
            <Link className="btn" href="/holding/discussion">
              Open Discussion Room <ChevronRight size={15} className="inline" />
            </Link>
          </div>
          <AgentGrid />
        </section>
      </div>
    </AppShell>
  );
}