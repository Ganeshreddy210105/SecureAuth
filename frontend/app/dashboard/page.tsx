'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Shield, CheckCircle, AlertTriangle, Users, Key, Calendar, Mail, Loader2, Sparkles, LogOut, ExternalLink } from 'lucide-react';

import Navbar from '@/components/Navbar';
import { api, getAccessToken, removeAccessToken } from '@/lib/api';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

// Custom JWT Decoder
function parseJwt(token: string) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      window
        .atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

export default function DashboardPage() {
  const router = useRouter();
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [accessRemaining, setAccessRemaining] = useState<string>('15:00');
  const [refreshRemaining, setRefreshRemaining] = useState<string>('7d 0h');

  // Check auth on load
  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.push('/login');
      return;
    }
    setAccessTokenState(token);
  }, [router]);

  // Query User Data
  const { data: user, isLoading: isUserLoading, error: userError } = useQuery({
    queryKey: ['userMe'],
    queryFn: async () => {
      const res = await api.get('/users/me');
      return res.data;
    },
    enabled: !!accessToken,
  });

  // Query Active Sessions
  const { data: sessions, isLoading: isSessionsLoading } = useQuery({
    queryKey: ['userSessions'],
    queryFn: async () => {
      const res = await api.get('/users/sessions');
      return res.data;
    },
    enabled: !!accessToken,
  });

  // Timer Countdown for Access and Refresh Token
  useEffect(() => {
    if (!accessToken) return;

    const payload = parseJwt(accessToken);
    if (!payload || !payload.exp) return;

    const interval = setInterval(() => {
      const expEpoch = payload.exp * 1000;
      const timeDiff = expEpoch - Date.now();

      if (timeDiff <= 0) {
        setAccessRemaining('Expired');
        // Fetch token again from storage to see if Axios interceptor refreshed it!
        const refreshedToken = getAccessToken();
        if (refreshedToken && refreshedToken !== accessToken) {
          setAccessTokenState(refreshedToken);
        }
      } else {
        const mins = Math.floor(timeDiff / 60000);
        const secs = Math.floor((timeDiff % 60000) / 1000);
        setAccessRemaining(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
      }

      // Refresh countdown (7 days from creation, we display approximation)
      const iatEpoch = payload.iat ? payload.iat * 1000 : Date.now();
      const refreshExpiryEpoch = iatEpoch + 7 * 24 * 60 * 60 * 1000;
      const refDiff = refreshExpiryEpoch - Date.now();
      
      if (refDiff <= 0) {
        setRefreshRemaining('Expired');
      } else {
        const days = Math.floor(refDiff / (24 * 60 * 60 * 1000));
        const hours = Math.floor((refDiff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
        setRefreshRemaining(`${days}d ${hours}h`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [accessToken]);

  // Handle errors
  if (userError) {
    removeAccessToken();
    router.push('/login');
  }

  if (isUserLoading || !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-zinc-400">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500 mb-4" />
        <p className="text-sm font-semibold tracking-wide uppercase">Verifying Session...</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ scale: 0.05, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ 
        type: 'spring', 
        stiffness: 40, 
        damping: 18,
        delay: 0.9, // Starts expanding at 0.9s (halfway through warp) and finishes as warp settles
      }}
      className="w-full min-h-screen flex flex-col pt-24 px-4 pb-12 max-w-5xl mx-auto origin-center"
    >
      <Navbar />

      {/* Greeting Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-xs font-semibold text-purple-300 mb-2">
            <Sparkles className="w-3 h-3" />
            Secure Session Active
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white mb-1">
            Welcome, {user.full_name || 'Developer'}
          </h1>
          <p className="text-zinc-400 text-sm font-mono">{user.email}</p>
        </div>

        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${
            user.is_verified 
              ? 'bg-green-500/10 border-green-500/20 text-green-400' 
              : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
          }`}>
            <CheckCircle className="w-3.5 h-3.5" />
            {user.is_verified ? 'Verified Account' : 'Pending Verification'}
          </div>
        </div>
      </div>

      {/* Token Expiry Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="glass-panel rounded-2xl p-6 glow-on-hover flex flex-col justify-between h-40">
          <div className="flex justify-between items-center text-zinc-400 text-xs uppercase font-semibold tracking-wider">
            <span>JWT Access Token Expiry</span>
            <Key className="w-4 h-4 text-purple-400" />
          </div>
          <div className="my-2">
            <div className="text-3xl font-mono font-bold text-white tracking-wider">{accessRemaining}</div>
            <p className="text-zinc-500 text-[10px] mt-1">Rotates automatically on expiration (15 min)</p>
          </div>
          <div className="w-full bg-zinc-800 h-1 rounded-full overflow-hidden">
            <div className="bg-purple-500 h-full animate-pulse" style={{ width: '100%' }} />
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-6 glow-on-hover flex flex-col justify-between h-40">
          <div className="flex justify-between items-center text-zinc-400 text-xs uppercase font-semibold tracking-wider">
            <span>Refresh Token TTL</span>
            <Calendar className="w-4 h-4 text-blue-400" />
          </div>
          <div className="my-2">
            <div className="text-3xl font-mono font-bold text-white tracking-wider">{refreshRemaining}</div>
            <p className="text-zinc-500 text-[10px] mt-1">Extended on active sessions (7 days)</p>
          </div>
          <div className="w-full bg-zinc-800 h-1 rounded-full overflow-hidden">
            <div className="bg-blue-505 h-full bg-blue-500" style={{ width: '100%' }} />
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-6 glow-on-hover flex flex-col justify-between h-40">
          <div className="flex justify-between items-center text-zinc-400 text-xs uppercase font-semibold tracking-wider">
            <span>Connected Identities</span>
            <Users className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="flex gap-2.5 my-3">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold ${
              user.oauth_provider === 'google' 
                ? 'bg-red-500/10 border-red-500/20 text-red-400' 
                : 'bg-zinc-800/40 border-white/5 text-zinc-500'
            }`}>
              Google
            </div>
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold ${
              user.oauth_provider === 'github' 
                ? 'bg-white/10 border-white/20 text-white' 
                : 'bg-zinc-800/40 border-white/5 text-zinc-500'
            }`}>
              GitHub
            </div>
          </div>
          <p className="text-zinc-500 text-[10px]">
            {user.oauth_provider 
              ? `Connected via ${user.oauth_provider}` 
              : 'Registered via Email Credentials'}
          </p>
        </div>
      </div>

      {/* Audit Log / Session Overview */}
      <div className="glass-panel rounded-2xl p-6 md:p-8 glow-on-hover">
        <div className="flex justify-between items-center border-b border-white/5 pb-4 mb-6">
          <div>
            <h2 className="text-lg font-bold text-white">Active Audit Log</h2>
            <p className="text-xs text-zinc-400 mt-0.5">Summary of currently running authentication states</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-zinc-900/30 border border-white/5 gap-4">
            <div className="flex gap-3.5 items-start">
              <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20 mt-0.5">
                <CheckCircle className="w-4 h-4 text-green-400" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Argon2 Password Verified</h4>
                <p className="text-xs text-zinc-400 mt-0.5">High-entropy cryptographic verification successful.</p>
              </div>
            </div>
            <span className="text-[10px] font-mono text-zinc-500 uppercase">Operational</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-zinc-900/30 border border-white/5 gap-4">
            <div className="flex gap-3.5 items-start">
              <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 mt-0.5">
                <Key className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Token Signature Standard</h4>
                <p className="text-xs text-zinc-400 mt-0.5">Tokens cryptographically signed using HS256 algorithm.</p>
              </div>
            </div>
            <span className="text-[10px] font-mono text-purple-400 uppercase">HS256 Standard</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
