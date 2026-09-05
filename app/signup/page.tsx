'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Brand } from '@/components/Brand';
import {
  APPROVED_LEGAL_NAMES,
  MASTER_RULES,
  isApprovedLegalName,
} from '@/lib/nevu';
import { createClient } from '@/lib/supabase/client';

export default function Signup() {
  const [step, setStep] = useState(1);
  const [legalName, setLegalName] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [holdingName, setHoldingName] = useState('');
  const [capital, setCapital] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [focus, setFocus] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  function verifyLegalName() {
    setError('');

    if (!isApprovedLegalName(legalName)) {
      setError('Access Denied. Legal name not recognized.');
      return;
    }

    setStep(2);
  }

  function validateStep2() {
    setError('');

    if (!fullName || !username || !email || !password || !holdingName || !capital) {
      setError('Please fill in all Administrator setup fields.');
      return;
    }

    setStep(3);
  }

  async function handleGoogleSignIn() {
    setError('');
    setLoading(true);
    const sb = createClient();

    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    }
  }

  async function createAdministrator() {
    setError('');

    if (!confirmed || !focus) {
      setError('All confirmations are required before proceeding.');
      return;
    }

    setLoading(true);
    const sb = createClient();

    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          legal_name: legalName,
          username,
          full_name: fullName,
          holding_name: holdingName,
          capital: Number(capital || 0),
          nevu_code: String(Math.floor(100000 + Math.random() * 900000)),
        },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Direct redirect to Boardroom if session is immediately granted (Email confirmation disabled)
    if (data?.session) {
      router.refresh();
      router.push('/hq/boardroom');
      return;
    }

    // Redirect to verification page if email confirmation is required
    if (data?.user) {
      localStorage.setItem('nevu_verification_email', email);
      router.push('/verify');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-5">
      <div className="w-full max-w-xl">
        <Brand />

        <div className="glass rounded-3xl p-7 mt-8">
          <div className="text-xs muted">
            FIRST-TIME SETUP · STEP {step}/4
          </div>

          {step === 1 && (
            <>
              <h1 className="text-2xl font-semibold mt-2">
                Legal Name Verification
              </h1>

              <p className="muted mt-2 text-sm">
                Access is restricted to approved stakeholders only.
              </p>

              <div className="mt-6 grid grid-cols-2 gap-2">
                {APPROVED_LEGAL_NAMES.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setLegalName(n)}
                    className={`btn text-left ${
                      legalName === n ? 'bg-white/10' : ''
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>

              <input
                className="input mt-3"
                placeholder="Or enter legal name"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
              />

              {error && (
                <div className="red text-sm mt-3">
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={verifyLegalName}
                className="btn primary mt-5 w-full"
              >
                Verify Legal Name
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="text-2xl font-semibold mt-2">
                Administrator Setup
              </h1>

              <button
                type="button"
                disabled={loading}
                onClick={handleGoogleSignIn}
                className="btn w-full mt-4 flex items-center justify-center gap-2 border border-white/10 py-2.5 rounded-xl hover:bg-white/5 transition text-sm disabled:opacity-50"
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
                Fast-track with Google
              </button>

              <div className="relative text-center text-xs muted my-4">
                <span>OR MANUAL CREATION</span>
              </div>

              <div className="mt-5 space-y-3">
                <input
                  className="input"
                  placeholder="Full Name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />

                <input
                  className="input"
                  placeholder="Preferred Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />

                <input
                  className="input"
                  placeholder="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />

                <input
                  className="input"
                  placeholder="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />

                <input
                  className="input"
                  placeholder="Holding Name"
                  value={holdingName}
                  onChange={(e) => setHoldingName(e.target.value)}
                  required
                />

                <input
                  className="input"
                  placeholder="Capital available for this setup"
                  type="number"
                  value={capital}
                  onChange={(e) => setCapital(e.target.value)}
                  required
                />
              </div>

              {error && (
                <div className="red text-sm mt-3">
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={validateStep2}
                className="btn primary mt-5 w-full"
              >
                Continue
              </button>

              <p className="mt-5 text-sm muted">
                Already registered?{' '}
                <Link href="/login" className="text-white">
                  Sign in
                </Link>
              </p>
            </>
          )}

          {step === 3 && (
            <>
              <h1 className="text-2xl font-semibold mt-2">
                NEVU HQ · Key Operating Rules
              </h1>

              <div className="mt-5 space-y-3">
                {MASTER_RULES.map((r, i) => (
                  <div key={r} className="card p-3 text-sm">
                    <span className="muted mr-2">{i + 1}.</span>
                    {r}
                  </div>
                ))}
              </div>

              <label className="flex gap-3 mt-5 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={focus}
                  onChange={(e) => setFocus(e.target.checked)}
                />
                <span>
                  I confirm Nigeria → Africa is the primary market focus.
                </span>
              </label>

              <button
                type="button"
                onClick={() => setStep(4)}
                className="btn primary mt-5 w-full"
              >
                Continue
              </button>
            </>
          )}

          {step === 4 && (
            <>
              <h1 className="text-2xl font-semibold mt-2">
                Administrator Account Summary
              </h1>

              <div className="mt-5 card p-5 space-y-2 text-sm">
                <p>
                  Legal Name: <b>{legalName}</b>
                </p>
                <p>
                  Username: <b>{username}</b>
                </p>
                <p>
                  Holding: <b>{holdingName}</b>
                </p>
                <p>
                  Capital for setup:{' '}
                  <b>₦{Number(capital || 0).toLocaleString()}</b>
                </p>
                <p>
                  Role: <b>Sole Administrator</b>
                </p>
              </div>

              <label className="flex gap-3 mt-5 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                <span>
                  I confirm creation of this Administrator account and accept
                  the Sole Administrator role.
                </span>
              </label>

              {error && (
                <div className="red text-sm mt-3">
                  {error}
                </div>
              )}

              <button
                type="button"
                disabled={loading}
                onClick={createAdministrator}
                className="btn primary mt-5 w-full disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Administrator'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}