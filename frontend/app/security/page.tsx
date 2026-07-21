'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, Key, Globe, Laptop, CheckCircle, Clock, Trash2, ShieldAlert, Loader2, LogOut } from 'lucide-react';
import { toast } from 'sonner';

import Navbar from '@/components/Navbar';
import { api, getAccessToken, removeAccessToken } from '@/lib/api';

interface SessionItem {
  id: string;
  user_agent: string;
  ip_address: string;
  created_at: string;
  expires_at: string;
  is_current: boolean;
}

export default function SecurityPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [accessToken, setAccessTokenState] = useState<string | null>(null);

  // Check auth
  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.push('/login');
      return;
    }
    setAccessTokenState(token);
  }, [router]);

  // Query User Data
  const { data: user, isLoading: isUserLoading } = useQuery({
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

  const revokeSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await api.delete(`/users/sessions/${sessionId}`);
      return res.data;
    },
    onSuccess: (_, sessionId) => {
      toast.success('Session revoked successfully.');
      queryClient.invalidateQueries({ queryKey: ['userSessions'] });
      
      // If we revoked the current session, log out
      const revokedCurrent = sessions?.find((s: SessionItem) => s.id === sessionId)?.is_current;
      if (revokedCurrent) {
        removeAccessToken();
        router.push('/login');
      }
    },
    onError: (error: any) => {
      const errorMsg = error.response?.data?.detail || 'Failed to revoke session.';
      toast.error(errorMsg);
    },
  });

  const revokeAllSessionsMutation = useMutation({
    mutationFn: async () => {
      const res = await api.delete('/users/sessions');
      return res.data;
    },
    onSuccess: () => {
      removeAccessToken();
      toast.success('All sessions have been revoked. Signed out.');
      router.push('/login');
    },
    onError: (error: any) => {
      const errorMsg = error.response?.data?.detail || 'Failed to revoke sessions.';
      toast.error(errorMsg);
    },
  });

  const handleRevoke = (sessionId: string) => {
    revokeSessionMutation.mutate(sessionId);
  };

  const handleRevokeAll = () => {
    revokeAllSessionsMutation.mutate();
  };

  const getBrowserIcon = (userAgent: string) => {
    const ua = userAgent.toLowerCase();
    if (ua.includes('chrome')) return Globe;
    if (ua.includes('firefox')) return Globe;
    if (ua.includes('safari')) return Laptop;
    return Globe;
  };

  const getFriendlyUA = (userAgent: string) => {
    const ua = userAgent.toLowerCase();
    if (ua.includes('chrome')) return 'Google Chrome';
    if (ua.includes('firefox')) return 'Mozilla Firefox';
    if (ua.includes('safari') && !ua.includes('chrome')) return 'Apple Safari';
    if (ua === 'testclient') return 'FastAPI TestClient';
    return userAgent.length > 25 ? userAgent.substring(0, 25) + '...' : userAgent;
  };

  if (isUserLoading || !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-zinc-400">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500 mb-4" />
        <p className="text-sm font-semibold tracking-wide uppercase">Loading Security Center...</p>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen flex flex-col pt-24 px-4 pb-12 max-w-5xl mx-auto">
      <Navbar />

      <h1 className="text-3xl font-extrabold tracking-tight text-white mb-8">
        Security Center
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Verification Status Checklist */}
        <div className="md:col-span-1 space-y-6">
          <div className="glass-panel rounded-2xl p-6 glow-on-hover">
            <h3 className="text-md font-bold text-white mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              Security Checklist
            </h3>

            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400 shrink-0">
                  ✓
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Email Address Verified</h4>
                  <p className="text-[10px] text-zinc-400 mt-0.5">Your email has been confirmed.</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400 shrink-0">
                  ✓
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">OAuth Connectivity</h4>
                  <p className="text-[10px] text-zinc-400 mt-0.5">
                    {user.oauth_provider 
                      ? `Linked with ${user.oauth_provider}.` 
                      : 'Standard credentials mode active.'}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
                  !
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Multi-Factor Auth (MFA)</h4>
                  <p className="text-[10px] text-zinc-400 mt-0.5">Setup passwordless OTP login bypass.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sessions list */}
        <div className="md:col-span-2 space-y-6">
          <div className="glass-panel rounded-2xl p-6 md:p-8 glow-on-hover">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/5 pb-4 mb-6">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Laptop className="w-5 h-5 text-cyan-400" />
                  Active Web Sessions
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">Audit log of other devices currently logged into your account</p>
              </div>

              <button
                onClick={handleRevokeAll}
                disabled={revokeAllSessionsMutation.isPending || !sessions || sessions.length === 0}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-500/20 bg-red-950/20 text-red-400 hover:bg-red-600 hover:text-white transition-all cursor-pointer disabled:opacity-50"
              >
                {revokeAllSessionsMutation.isPending ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <LogOut className="w-3 h-3" />
                )}
                Logout All Devices
              </button>
            </div>

            {isSessionsLoading ? (
              <div className="flex items-center justify-center py-12 text-zinc-500">
                <Loader2 className="w-6 h-6 animate-spin text-cyan-400 mr-2" />
                <span className="text-xs font-semibold">Fetching Session Registry...</span>
              </div>
            ) : !sessions || sessions.length === 0 ? (
              <div className="text-center py-12 text-zinc-500 text-xs">
                No active sessions registered.
              </div>
            ) : (
              <div className="space-y-4">
                {sessions.map((session: SessionItem) => {
                  const Icon = getBrowserIcon(session.user_agent);
                  return (
                    <div 
                      key={session.id}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border transition-all ${
                        session.is_current 
                          ? 'bg-purple-950/5 border-purple-500/20' 
                          : 'bg-zinc-900/20 border-white/5 hover:border-white/10'
                      }`}
                    >
                      <div className="flex gap-4 items-start">
                        <div className={`p-2.5 rounded-lg border ${
                          session.is_current 
                            ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' 
                            : 'bg-zinc-800/60 border-white/5 text-zinc-400'
                        }`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-white">
                              {getFriendlyUA(session.user_agent)}
                            </h4>
                            {session.is_current && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 uppercase tracking-wide">
                                Current
                              </span>
                            )}
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400 font-mono mt-1">
                            <span className="flex items-center gap-1">
                              IP: {session.ip_address}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-zinc-500" />
                              Created: {new Date(session.created_at).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end mt-4 sm:mt-0 sm:ml-4">
                        <button
                          onClick={() => handleRevoke(session.id)}
                          disabled={revokeSessionMutation.isPending}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-900 border border-white/5 text-zinc-400 hover:bg-zinc-800 hover:text-red-400 transition-all cursor-pointer disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Revoke</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
