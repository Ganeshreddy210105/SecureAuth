'use client';

import React, { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Shield, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { setAccessToken } from '@/lib/api';

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const accessToken = searchParams.get('access_token');
  const error = searchParams.get('error');

  useEffect(() => {
    if (error) {
      toast.error(`Authentication failed: ${error}`);
      router.push('/login');
      return;
    }

    if (accessToken) {
      // Store token and redirect
      setAccessToken(accessToken);
      toast.success('Connected successfully!');
      router.push('/dashboard');
    } else {
      toast.error('Token missing from OAuth redirect.');
      router.push('/login');
    }
  }, [accessToken, error, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-zinc-400">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center shadow-2xl mb-6 animate-pulse">
        <Shield className="w-8 h-8 text-white" />
      </div>
      <Loader2 className="w-6 h-6 animate-spin text-cyan-400 mb-2" />
      <p className="text-xs uppercase tracking-widest font-mono text-zinc-500">
        Exchanging Credentials...
      </p>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-screen text-zinc-400">
        <Loader2 className="w-6 h-6 animate-spin text-cyan-400 mb-2" />
        <p className="text-xs uppercase tracking-widest font-mono text-zinc-500">Loading...</p>
      </div>
    }>
      <CallbackContent />
    </Suspense>
  );
}
