'use client';

import React, { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { Shield, Loader2, ArrowLeft, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

import GlassCard from '@/components/ui/GlassCard';
import { api } from '@/lib/api';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';

  const [code, setCode] = useState<string[]>(new Array(6).fill(''));
  const [countdown, setCountdown] = useState(0);
  const inputRefs = useRef<HTMLInputElement[]>([]);

  useEffect(() => {
    if (!email) {
      toast.error('Email address is missing from request.');
      router.push('/register');
    }
  }, [email, router]);

  // Handle countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleChange = (element: HTMLInputElement, index: number) => {
    const value = element.value.replace(/[^0-9]/g, '');
    if (!value) return;

    const newCode = [...code];
    newCode[index] = value.substring(value.length - 1);
    setCode(newCode);

    // Auto focus next input
    if (index < 5 && element.value !== '') {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace') {
      const newCode = [...code];
      newCode[index] = '';
      setCode(newCode);
      
      // Auto focus previous input
      if (index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').replace(/[^0-9]/g, '').substring(0, 6);
    if (pasteData.length === 6) {
      const newCode = pasteData.split('');
      setCode(newCode);
      inputRefs.current[5]?.focus();
    }
  };

  const verifyMutation = useMutation({
    mutationFn: async (verificationCode: string) => {
      const res = await api.post('/auth/verify-email', {
        email,
        code: verificationCode,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Email verified successfully! You can now log in.');
      router.push('/login');
    },
    onError: (error: any) => {
      const errorMsg = error.response?.data?.detail || 'Verification failed. Please check the code.';
      toast.error(errorMsg);
    },
  });

  const resendMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/auth/resend-verification', { email });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Verification code resent successfully.');
      setCountdown(60); // Set 60 seconds cooldown
    },
    onError: (error: any) => {
      const errorMsg = error.response?.data?.detail || 'Failed to resend code.';
      toast.error(errorMsg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fullCode = code.join('');
    if (fullCode.length < 6) {
      toast.error('Please enter the full 6-digit code.');
      return;
    }
    verifyMutation.mutate(fullCode);
  };

  const handleResend = () => {
    if (countdown > 0) return;
    resendMutation.mutate();
  };

  return (
    <div className="w-full flex items-center justify-center p-4">
      <GlassCard delay={0.1}>
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center shadow-lg mb-4">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white mb-1">Verify Email</h2>
          <p className="text-zinc-400 text-sm">
            We sent a verification code to <br />
            <span className="text-zinc-200 font-medium font-mono">{email}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex justify-between gap-2 max-w-sm mx-auto">
            {code.map((data, index) => (
              <input
                key={index}
                type="text"
                maxLength={1}
                ref={(el) => { if (el) inputRefs.current[index] = el; }}
                value={data}
                onChange={(e) => handleChange(e.target, index)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                onPaste={index === 0 ? handlePaste : undefined}
                className="w-12 h-12 text-center text-xl font-bold rounded-lg glass-input focus:border-cyan-400 focus:box-shadow-[0_0_10px_rgba(6,182,212,0.2)] focus:ring-cyan-500/25"
              />
            ))}
          </div>

          <button
            type="submit"
            disabled={verifyMutation.isPending}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg font-semibold bg-gradient-to-r from-purple-600 to-blue-500 text-white hover:from-purple-500 hover:to-blue-400 disabled:opacity-50 transition-all cursor-pointer shadow-lg"
          >
            {verifyMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Verifying Code...
              </>
            ) : (
              'Verify Code'
            )}
          </button>
        </form>

        <div className="mt-6 flex flex-col items-center gap-4 text-center">
          <button
            onClick={handleResend}
            disabled={countdown > 0 || resendMutation.isPending}
            className={`flex items-center gap-1.5 text-xs font-semibold transition-all ${
              countdown > 0 
                ? 'text-zinc-500 cursor-not-allowed' 
                : 'text-cyan-400 hover:text-cyan-300 cursor-pointer'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${resendMutation.isPending ? 'animate-spin' : ''}`} />
            {countdown > 0 ? `Resend Code in ${countdown}s` : 'Resend Verification Code'}
          </button>

          <Link 
            href="/login"
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Login
          </Link>
        </div>
      </GlassCard>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-screen text-zinc-400">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500 mb-4" />
        <p className="text-sm font-semibold tracking-wide uppercase">Loading Verification...</p>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
