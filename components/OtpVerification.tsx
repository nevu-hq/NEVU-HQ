'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function OtpVerification({ email }: { email: string }) {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const supabase = createClient();

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: 'signup', // Change to 'email' if verifying login without signup
    });

    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
      window.location.href = '/dashboard';
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-xl border border-gray-200 shadow-sm">
      <h2 className="text-xl font-bold mb-2">Check your email</h2>
      <p className="text-sm text-gray-600 mb-6">
        Enter the 6-digit confirmation code sent to <strong>{email}</strong>.
      </p>

      {success ? (
        <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm font-medium">
          Email confirmed successfully! Redirecting...
        </div>
      ) : (
        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="w-full text-center text-3xl font-mono tracking-[0.75rem] py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
              required
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || otp.length !== 6}
            className="w-full bg-black text-white py-3 rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50 transition-all"
          >
            {loading ? 'Verifying...' : 'Verify Email'}
          </button>
        </form>
      )}
    </div>
  );
}