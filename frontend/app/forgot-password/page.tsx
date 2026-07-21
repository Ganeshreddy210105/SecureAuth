'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation } from '@tanstack/react-query';
import { Shield, Mail, Lock, Loader2, ArrowLeft, ArrowRight, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

import GlassCard from '@/components/ui/GlassCard';
import { api } from '@/lib/api';

const emailSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

const resetSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters')
    .refine((val) => /[A-Z]/.test(val), { message: "Must contain an uppercase letter" })
    .refine((val) => /[a-z]/.test(val), { message: "Must contain a lowercase letter" })
    .refine((val) => /\d/.test(val), { message: "Must contain a number" })
    .refine((val) => /[!@#$%^&*(),.?":{}|<>]/.test(val), { message: "Must contain a special symbol" }),
  confirm_password: z.string(),
}).refine((data) => data.password === data.confirm_password, {
  message: "Passwords don't match",
  path: ['confirm_password'],
});

type EmailFields = z.infer<typeof emailSchema>;
type ResetFields = z.infer<typeof resetSchema>;

function ForgotPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [step, setStep] = useState<1 | 2>(1); // 1 = Request, 2 = Set New (if token exists)
  const [successRequested, setSuccessRequested] = useState(false);

  useEffect(() => {
    if (token) {
      setStep(2);
    } else {
      setStep(1);
    }
  }, [token]);

  const {
    register: registerEmail,
    handleSubmit: handleSubmitEmail,
    formState: { errors: emailErrors },
  } = useForm<EmailFields>({
    resolver: zodResolver(emailSchema),
  });

  const {
    register: registerReset,
    handleSubmit: handleSubmitReset,
    formState: { errors: resetErrors },
  } = useForm<ResetFields>({
    resolver: zodResolver(resetSchema),
  });

  const requestMutation = useMutation({
    mutationFn: async (data: EmailFields) => {
      const res = await api.post('/auth/forgot-password', data);
      return res.data;
    },
    onSuccess: () => {
      setSuccessRequested(true);
      toast.success('Password reset email sent (if email exists).');
    },
    onError: (error: any) => {
      const errorMsg = error.response?.data?.detail || 'Failed to request reset.';
      toast.error(errorMsg);
    },
  });

  const resetMutation = useMutation({
    mutationFn: async (data: ResetFields) => {
      const res = await api.post('/auth/reset-password', {
        token,
        new_password: data.password,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Password reset successfully! Please login with your new password.');
      router.push('/login');
    },
    onError: (error: any) => {
      const errorMsg = error.response?.data?.detail || 'Reset failed. Token may be invalid or expired.';
      toast.error(errorMsg);
    },
  });

  const onRequestSubmit = (data: EmailFields) => {
    requestMutation.mutate(data);
  };

  const onResetSubmit = (data: ResetFields) => {
    resetMutation.mutate(data);
  };

  return (
    <div className="w-full flex items-center justify-center p-4">
      <GlassCard delay={0.1}>
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center shadow-lg mb-4">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white mb-1">
            {step === 1 ? 'Reset Password' : 'New Password'}
          </h2>
          <p className="text-zinc-400 text-sm">
            {step === 1 
              ? 'Request a link to recover your credentials' 
              : 'Enter a strong new password for your account'}
          </p>
        </div>

        {step === 1 ? (
          successRequested ? (
            <div className="text-center py-6 space-y-4">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
              <h3 className="text-lg font-bold text-white">Reset Link Sent</h3>
              <p className="text-zinc-400 text-xs leading-relaxed max-w-xs mx-auto">
                If the email is registered on our system, a link has been dispatched to reset your credentials. Please check your inbox and spam folder.
              </p>
              <div className="pt-4">
                <Link 
                  href="/login"
                  className="flex items-center justify-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 font-semibold"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to Login
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmitEmail(onRequestSubmit)} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5 uppercase tracking-wide">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-4 h-4 text-zinc-500" />
                  <input
                    type="email"
                    placeholder="you@example.com"
                    className={`glass-input w-full pl-10 pr-4 py-2.5 rounded-lg text-sm ${
                      emailErrors.email ? 'border-red-500/50 focus:border-red-500' : ''
                    }`}
                    {...registerEmail('email')}
                  />
                </div>
                {emailErrors.email && (
                  <p className="text-red-500 text-xs mt-1">{emailErrors.email.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={requestMutation.isPending}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg font-semibold bg-gradient-to-r from-purple-600 to-blue-500 text-white hover:from-purple-500 hover:to-blue-400 disabled:opacity-50 transition-all cursor-pointer shadow-lg mt-2"
              >
                {requestMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Requesting Link...
                  </>
                ) : (
                  <>
                    Send Recovery Link
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )
        ) : (
          <form onSubmit={handleSubmitReset(onResetSubmit)} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5 uppercase tracking-wide">
                New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-zinc-500" />
                <input
                  type="password"
                  placeholder="••••••••"
                  className={`glass-input w-full pl-10 pr-4 py-2 rounded-lg text-sm ${
                    resetErrors.password ? 'border-red-500/50 focus:border-red-500' : ''
                  }`}
                  {...registerReset('password')}
                />
              </div>
              {resetErrors.password && (
                <p className="text-red-500 text-xs mt-1">{resetErrors.password.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5 uppercase tracking-wide">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-zinc-500" />
                <input
                  type="password"
                  placeholder="••••••••"
                  className={`glass-input w-full pl-10 pr-4 py-2 rounded-lg text-sm ${
                    resetErrors.confirm_password ? 'border-red-500/50 focus:border-red-500' : ''
                  }`}
                  {...registerReset('confirm_password')}
                />
              </div>
              {resetErrors.confirm_password && (
                <p className="text-red-500 text-xs mt-1">{resetErrors.confirm_password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={resetMutation.isPending}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg font-semibold bg-gradient-to-r from-purple-600 to-blue-500 text-white hover:from-purple-500 hover:to-blue-400 disabled:opacity-50 transition-all cursor-pointer shadow-lg mt-4"
            >
              {resetMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Resetting Password...
                </>
              ) : (
                'Save Password'
              )}
            </button>
          </form>
        )}

        {!successRequested && (
          <div className="mt-6 text-center">
            <Link 
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Login
            </Link>
          </div>
        )}
      </GlassCard>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-screen text-zinc-400">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500 mb-4" />
        <p className="text-sm font-semibold tracking-wide uppercase">Loading Password Reset...</p>
      </div>
    }>
      <ForgotPasswordContent />
    </Suspense>
  );
}
