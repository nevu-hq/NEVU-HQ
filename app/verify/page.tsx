'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Brand } from '@/components/Brand';

function VerifyForm() {
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [email, setEmail] = useState('');

  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // 1. Retrieve email from localStorage or URL parameter
    const storedEmail = localStorage.getItem('nevu_verification_email');
    const urlEmail = searchParams.get('email');

    if (storedEmail) {
      setEmail(storedEmail);
    } else if (urlEmail) {
      setEmail(urlEmail);
      localStorage.setItem('nevu_verification_email', urlEmail);
    }

    // 2. Handle auto-verification if user clicked an email magic link (?code=...)
    async function handleEmailLink() {
      const codeFromUrl = searchParams.get('code');

      if (!codeFromUrl) return;

      setLoading(true);
      setMsg('Verifying your email...');

      const sb = createClient();

      const { error } = await sb.auth.exchangeCodeForSession(codeFromUrl);

      if (error) {
        setMsg(error.message);
        setLoading(false);
        return;
      }

      await sb.rpc('nevu_complete_setup');

      router.replace('/holding');
    }

    handleEmailLink();
  }, [searchParams, router]);

  async function verify() {
    const cleanCode = code.replace(/\D/g, '').slice(0, 6);

    if (cleanCode.length !== 6) {
      setMsg('Enter the 6-digit verification code from your NEVU HQ email.');
      return;
    }

    if (!email) {
      setMsg('Your signup email could not be found. Please return to signup.');
      return;
    }

    setLoading(true);
    setMsg('');

    const sb = createClient();

    const { data, error } = await sb.auth.verifyOtp({
      email,
      token: cleanCode,
      type: 'signup',
    });

    if (error) {
      setMsg(error.message);
      setLoading(false);
      return;
    }

    if (!data.session) {
      setMsg('Email verified, but no active session was created. Please sign in.');
      setLoading(false);
      return;
    }

    await sb.rpc('nevu_complete_setup');

    router.replace('/holding');
  }

  async function resend() {
    if (!email) {
      setMsg('Your signup email could not be found. Please return to signup.');
      return;
    }

    setResending(true);
    setMsg('');

    const sb = createClient();

    const { error } = await sb.auth.resend({
      type: 'signup',
      email,
    });

    if (error) {
      setMsg(error.message);
    } else {
      setMsg('A new verification email has been sent. Check your inbox.');
    }

    setResending(false);
  }

  return (
    <div className="w-full max-w-md">
      <Brand />

      <div className="glass rounded-3xl p-7 mt-8">
        <h1 className="text-2xl font-semibold">
          Verify your email
        </h1>

        <p className="muted text-sm mt-2">
          Enter the 6-digit code from your NEVU HQ verification email.
          You can also use the verification link in that email.
        </p>

        {email && (
          <p className="text-sm mt-4">
            Verification email sent to <strong>{email}</strong>
          </p>
        )}

        <input
          className="input mt-6 text-center tracking-[.5em]"
          value={code}
          onChange={(e) =>
            setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
          }
          placeholder="000000"
          inputMode="numeric"
          maxLength={6}
          autoComplete="one-time-code"
        />

        <button
          onClick={verify}
          disabled={loading || resending}
          className="btn primary mt-4 w-full"
        >
          {loading ? 'Verifying...' : 'Verify & Enter HQ'}
        </button>

        <button
          onClick={resend}
          disabled={loading || resending}
          className="w-full mt-4 text-sm underline"
        >
          {resending ? 'Sending...' : 'Resend verification email'}
        </button>

        {msg && (
          <p className="red text-sm mt-3">
            {msg}
          </p>
        )}
      </div>
    </div>
  );
}

export default function Verify() {
  return (
    <div className="min-h-screen flex items-center justify-center p-5">
      <Suspense fallback={<div className="text-center">Loading...</div>}>
        <VerifyForm />
      </Suspense>
    </div>
  );
}