'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation } from '@tanstack/react-query';
import { Shield, Mail, Loader2, ArrowLeft, ArrowRight, Smartphone, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

import GlassCard from '@/components/ui/GlassCard';
import { api, setAccessToken } from '@/lib/api';

const emailSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type EmailFields = z.infer<typeof emailSchema>;

export default function OTPLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState<string[]>(new Array(6).fill(''));
  const [countdown, setCountdown] = useState(0);
  const inputRefs = useRef<HTMLInputElement[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EmailFields>({
    resolver: zodResolver(emailSchema),
  });

  // Handle countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const sendOTPMutation = useMutation({
    mutationFn: async (targetEmail: string) => {
      const res = await api.post('/auth/send-otp', { email: targetEmail });
      return res.data;
    },
    onSuccess: (_, targetEmail) => {
      toast.success('OTP sent successfully to your email.');
      setEmail(targetEmail);
      setStep(2);
      setCountdown(60);
    },
    onError: (error: any) => {
      const errorMsg = error.response?.data?.detail || 'Failed to send OTP.';
      toast.error(errorMsg);
    },
  });

  const loginOTPMutation = useMutation({
    mutationFn: async (otpCode: string) => {
      const res = await api.post('/auth/login-otp', {
        email,
        code: otpCode,
      });
      return res.data;
    },
    onSuccess: (data) => {
      setAccessToken(data.access_token);
      toast.success('Logged in successfully!');
      router.push('/dashboard');
    },
    onError: (error: any) => {
      const errorMsg = error.response?.data?.detail || 'Invalid or expired OTP code.';
      toast.error(errorMsg);
    },
  });

  const handleEmailSubmit = (data: EmailFields) => {
    sendOTPMutation.mutate(data.email);
  };

  const handleOTPSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fullCode = code.join('');
    if (fullCode.length < 6) {
      toast.error('Please enter the full 6-digit code.');
      return;
    }
    loginOTPMutation.mutate(fullCode);
  };

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

  const handleResend = () => {
    if (countdown > 0) return;
    sendOTPMutation.mutate(email);
  };

  return (
    <div className="w-full flex items-center justify-center p-4">
      <GlassCard delay={0.1}>
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center shadow-lg mb-4">
            <Smartphone className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white mb-1">OTP Authentication</h2>
          <p className="text-zinc-400 text-sm">Sign in securely using passwordless codes</p>
        </div>

        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.div
              key="step-email"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
            >
              <form onSubmit={handleSubmit(handleEmailSubmit)} className="space-y-4">
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
                        errors.email ? 'border-red-500/50 focus:border-red-500' : ''
                      }`}
                      {...register('email')}
                    />
                  </div>
                  {errors.email && (
                    <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={sendOTPMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-lg font-semibold bg-gradient-to-r from-purple-600 to-blue-500 text-white hover:from-purple-500 hover:to-blue-400 disabled:opacity-50 transition-all cursor-pointer shadow-lg mt-2"
                >
                  {sendOTPMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending OTP...
                    </>
                  ) : (
                    <>
                      Send OTP Code
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="step-code"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              <form onSubmit={handleOTPSubmit} className="space-y-6">
                <div className="text-center mb-4">
                  <p className="text-xs text-zinc-400">
                    Enter the code sent to <br />
                    <span className="text-zinc-200 font-medium font-mono">{email}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="text-xs text-purple-400 hover:text-purple-300 font-semibold mt-1"
                  >
                    Change Email
                  </button>
                </div>

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
                      className="w-12 h-12 text-center text-xl font-bold rounded-lg glass-input focus:border-cyan-400 focus:ring-cyan-500/25"
                    />
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={loginOTPMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-lg font-semibold bg-gradient-to-r from-purple-600 to-blue-500 text-white hover:from-purple-500 hover:to-blue-400 disabled:opacity-50 transition-all cursor-pointer shadow-lg"
                >
                  {loginOTPMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Signing In...
                    </>
                  ) : (
                    'Verify & Sign In'
                  )}
                </button>
              </form>

              <div className="mt-6 flex justify-center">
                <button
                  onClick={handleResend}
                  disabled={countdown > 0 || sendOTPMutation.isPending}
                  className={`flex items-center gap-1.5 text-xs font-semibold transition-all ${
                    countdown > 0 
                      ? 'text-zinc-500 cursor-not-allowed' 
                      : 'text-cyan-400 hover:text-cyan-300 cursor-pointer'
                  }`}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${sendOTPMutation.isPending ? 'animate-spin' : ''}`} />
                  {countdown > 0 ? `Resend Code in ${countdown}s` : 'Resend OTP Code'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-6 text-center">
          <Link 
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Password Login
          </Link>
        </div>
      </GlassCard>
    </div>
  );
}
