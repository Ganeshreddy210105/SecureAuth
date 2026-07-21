'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation } from '@tanstack/react-query';
import { Shield, Mail, Lock, Loader2, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

import GlassCard from '@/components/ui/GlassCard';
import { api, setAccessToken } from '@/lib/api';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFields = z.infer<typeof loginSchema>;

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const message = searchParams.get('message');
  const [showPassword, setShowPassword] = useState(false);

  // If redirect message is session_expired
  React.useEffect(() => {
    if (message === 'session_expired') {
      toast.error('Your session has expired. Please log in again.');
    }
  }, [message]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFields>({
    resolver: zodResolver(loginSchema),
  });

  const mutation = useMutation({
    mutationFn: async (data: LoginFields) => {
      const res = await api.post('/auth/login', data);
      return res.data;
    },
    onSuccess: (data) => {
      setAccessToken(data.access_token);
      toast.success('Logged in successfully!');
      router.push('/dashboard');
    },
    onError: (error: any) => {
      const errorMsg = error.response?.data?.detail || 'Invalid email or password.';
      toast.error(errorMsg);
    },
  });

  const onSubmit = (data: LoginFields) => {
    mutation.mutate(data);
  };

  const handleOAuth = (provider: 'google' | 'github') => {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
    window.location.href = `${backendUrl}/auth/${provider}/login`;
  };

  return (
    <div className="w-full flex items-center justify-center p-4">
      <GlassCard delay={0.1}>
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center shadow-lg mb-4">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white mb-2">Welcome Back</h2>
          <p className="text-zinc-400 text-sm">Sign in to your SecureAuth workspace</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wide">
                Password
              </label>
              <Link 
                href="/forgot-password"
                className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
              >
                Forgot Password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-4 h-4 text-zinc-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                className={`glass-input w-full pl-10 pr-10 py-2.5 rounded-lg text-sm ${
                  errors.password ? 'border-red-500/50 focus:border-red-500' : ''
                }`}
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3.5 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg font-semibold bg-gradient-to-r from-purple-600 to-blue-500 text-white hover:from-purple-500 hover:to-blue-400 disabled:opacity-50 transition-all cursor-pointer shadow-lg hover:shadow-purple-500/10 mt-2"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Signing In...
              </>
            ) : (
              <>
                Sign In
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="relative my-6 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/5" />
          </div>
          <span className="relative bg-[#18181B] px-3 text-xs text-zinc-500 uppercase tracking-wider">
            Or continue with
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            onClick={() => handleOAuth('google')}
            className="flex items-center justify-center gap-2 py-2.5 rounded-lg border border-white/10 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-200 text-xs font-semibold cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.68 1.54 14.98 1 12 1 7.35 1 3.37 3.67 1.39 7.56l3.86 3C6.18 7.56 8.84 5.04 12 5.04z"/>
              <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.35H12v4.51h6.48c-.29 1.48-1.14 2.73-2.4 3.57v3h3.86c2.26-2.09 3.55-5.16 3.55-8.73z"/>
              <path fill="#FBBC05" d="M5.25 14.44c-.25-.75-.39-1.55-.39-2.44s.14-1.69.39-2.44L1.39 6.56C.5 8.2.01 10.04.01 12s.49 3.8 1.38 5.44l3.86-3z"/>
              <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.92l-3.86-3c-1.08.72-2.47 1.16-4.1 1.16-3.16 0-5.82-2.52-6.75-5.52l-3.86 3C3.37 20.33 7.35 23 12 23z"/>
            </svg>
            Google
          </button>
          <button
            onClick={() => handleOAuth('github')}
            className="flex items-center justify-center gap-2 py-2.5 rounded-lg border border-white/10 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-200 text-xs font-semibold cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <svg className="w-4 h-4 fill-current text-white" viewBox="0 0 24 24">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.137 20.162 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
            </svg>
            GitHub
          </button>
        </div>

        <div className="flex flex-col items-center gap-2 text-center text-xs">
          <span className="text-zinc-500">
            Don't have an account?{' '}
            <Link href="/register" className="text-purple-400 hover:text-purple-300 font-semibold transition-colors">
              Sign Up
            </Link>
          </span>
          <span className="text-zinc-500">
            Want passwordless login?{' '}
            <Link href="/otp-login" className="text-cyan-400 hover:text-cyan-300 font-semibold transition-colors">
              Login using OTP
            </Link>
          </span>
        </div>
      </GlassCard>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-screen text-zinc-400">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500 mb-4" />
        <p className="text-sm font-semibold tracking-wide uppercase">Loading Login...</p>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
