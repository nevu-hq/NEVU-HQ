'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Brand } from '@/components/Brand';
import { createClient } from '@/lib/supabase/client';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const sb = createClient();
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    else router.push('/holding');
    setLoading(false);
  }

  async function handleGoogleSignIn() {
    const sb = createClient();
    await sb.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-5">
      <div className="w-full max-w-md">
        <Brand />
        <div className="glass rounded-3xl p-7 mt-8">
          <h1 className="text-2xl font-semibold">Welcome back, CEO.</h1>
          <p className="muted mt-2 text-sm">Enter directly into your Holding HQ.</p>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="btn w-full mt-6 flex items-center justify-center gap-2 border border-white/10 py-2.5 rounded-xl hover:bg-white/5 transition text-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            Continue with Google
          </button>

          <div className="relative text-center text-xs muted my-5">
            <span>OR EMAIL & PASSWORD</span>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <input
              className="input"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              className="input"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {error && <div className="text-sm red">{error}</div>}
            <button className="btn primary w-full" disabled={loading}>
              {loading ? 'Signing in…' : 'Enter NEVU HQ'}
            </button>
          </form>

          <p className="mt-5 text-sm muted">
            New Administrator?{' '}
            <Link className="text-white" href="/signup">
              Begin setup
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}