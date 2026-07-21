'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation } from '@tanstack/react-query';
import { Shield, Mail, Lock, User, Loader2, Check, X, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

import GlassCard from '@/components/ui/GlassCard';
import { api } from '@/lib/api';

const registerSchema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm_password: z.string(),
}).refine((data) => data.password === data.confirm_password, {
  message: "Passwords don't match",
  path: ['confirm_password'],
});

type RegisterFields = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFields>({
    resolver: zodResolver(registerSchema),
  });

  const watchPassword = watch('password', '');

  useEffect(() => {
    setPassword(watchPassword);
  }, [watchPassword]);

  // Live password rules checklist
  const rules = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /\d/.test(password),
    symbol: /[!@#$%^&*(),.?":{}|<>]/.test(password),
  };

  const strengthCount = Object.values(rules).filter(Boolean).length;
  
  // Calculate meter bar color and width
  const getStrengthLabel = () => {
    if (strengthCount <= 2) return { label: 'Weak', color: 'bg-red-500' };
    if (strengthCount <= 4) return { label: 'Medium', color: 'bg-yellow-500' };
    return { label: 'Strong', color: 'bg-green-500' };
  };

  const strength = getStrengthLabel();

  const mutation = useMutation({
    mutationFn: async (data: Omit<RegisterFields, 'confirm_password'>) => {
      const res = await api.post('/auth/register', data);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success('Registration successful! Verification code sent.');
      router.push(`/verify-email?email=${encodeURIComponent(data.email)}`);
    },
    onError: (error: any) => {
      const errorMsg = error.response?.data?.detail || 'Registration failed. Try again.';
      toast.error(errorMsg);
    },
  });

  const onSubmit = (data: RegisterFields) => {
    if (strengthCount < 5) {
      toast.error('Password does not meet all security rules.');
      return;
    }
    mutation.mutate({
      email: data.email,
      password: data.password,
      full_name: data.full_name,
    });
  };

  return (
    <div className="w-full flex items-center justify-center p-4 my-8">
      <GlassCard delay={0.1}>
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center shadow-lg mb-4">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white mb-1">Create Account</h2>
          <p className="text-zinc-400 text-sm">Join SecureAuth Identity platform</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5 uppercase tracking-wide">
              Full Name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-3 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                placeholder="John Doe"
                className={`glass-input w-full pl-10 pr-4 py-2 rounded-lg text-sm ${
                  errors.full_name ? 'border-red-500/50 focus:border-red-500' : ''
                }`}
                {...register('full_name')}
              />
            </div>
            {errors.full_name && (
              <p className="text-red-500 text-xs mt-1">{errors.full_name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5 uppercase tracking-wide">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-4 h-4 text-zinc-500" />
              <input
                type="email"
                placeholder="john@example.com"
                className={`glass-input w-full pl-10 pr-4 py-2 rounded-lg text-sm ${
                  errors.email ? 'border-red-500/50 focus:border-red-500' : ''
                }`}
                autoComplete="off"
                {...register('email')}
              />
            </div>
            {errors.email && (
              <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5 uppercase tracking-wide">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-4 h-4 text-zinc-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                className={`glass-input w-full pl-10 pr-10 py-2 rounded-lg text-sm ${
                  errors.password ? 'border-red-500/50 focus:border-red-500' : ''
                }`}
                autoComplete="new-password"
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            
            {/* Live Password Strength Meter */}
            {password && (
              <div className="mt-2.5 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400">Password Strength:</span>
                  <span className="font-semibold text-zinc-200">{strength.label}</span>
                </div>
                <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${strength.color} transition-all duration-300`} 
                    style={{ width: `${(strengthCount / 5) * 100}%` }}
                  />
                </div>
                
                {/* Rules Checklist */}
                <div className="grid grid-cols-2 gap-2 mt-2 border-t border-white/5 pt-2 text-[10px] sm:text-xs">
                  <div className="flex items-center gap-1.5">
                    {rules.length ? <Check className="w-3.5 h-3.5 text-green-500" /> : <X className="w-3.5 h-3.5 text-red-500" />}
                    <span className={rules.length ? 'text-zinc-300' : 'text-zinc-500'}>8+ Characters</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {rules.upper ? <Check className="w-3.5 h-3.5 text-green-500" /> : <X className="w-3.5 h-3.5 text-red-500" />}
                    <span className={rules.upper ? 'text-zinc-300' : 'text-zinc-500'}>Uppercase Letter</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {rules.lower ? <Check className="w-3.5 h-3.5 text-green-500" /> : <X className="w-3.5 h-3.5 text-red-500" />}
                    <span className={rules.lower ? 'text-zinc-300' : 'text-zinc-500'}>Lowercase Letter</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {rules.number ? <Check className="w-3.5 h-3.5 text-green-500" /> : <X className="w-3.5 h-3.5 text-red-500" />}
                    <span className={rules.number ? 'text-zinc-300' : 'text-zinc-500'}>At least 1 Number</span>
                  </div>
                  <div className="flex items-center gap-1.5 col-span-2">
                    {rules.symbol ? <Check className="w-3.5 h-3.5 text-green-500" /> : <X className="w-3.5 h-3.5 text-red-500" />}
                    <span className={rules.symbol ? 'text-zinc-300' : 'text-zinc-500'}>At least 1 Special Symbol</span>
                  </div>
                </div>
              </div>
            )}
            {errors.password && (
              <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5 uppercase tracking-wide">
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-4 h-4 text-zinc-500" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="••••••••"
                className={`glass-input w-full pl-10 pr-10 py-2 rounded-lg text-sm ${
                  errors.confirm_password ? 'border-red-500/50 focus:border-red-500' : ''
                }`}
                autoComplete="new-password"
                {...register('confirm_password')}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-2.5 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.confirm_password && (
              <p className="text-red-500 text-xs mt-1">{errors.confirm_password.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg font-semibold bg-gradient-to-r from-purple-600 to-blue-500 text-white hover:from-purple-500 hover:to-blue-400 disabled:opacity-50 transition-all cursor-pointer shadow-lg hover:shadow-purple-500/10 mt-4"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating Account...
              </>
            ) : (
              <>
                Sign Up
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="text-center text-xs text-zinc-500 mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-purple-400 hover:text-purple-300 font-semibold transition-colors">
            Sign In
          </Link>
        </div>
      </GlassCard>
    </div>
  );
}
