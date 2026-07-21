'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import GlassCard from '@/components/ui/GlassCard';

export default function NotFound() {
  return (
    <div className="w-full flex items-center justify-center p-4">
      <GlassCard delay={0.1}>
        <div className="flex flex-col items-center py-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-600 to-amber-500 flex items-center justify-center shadow-lg mb-6">
            <ShieldAlert className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-extrabold text-white mb-2">404</h1>
          <h2 className="text-xl font-bold text-zinc-200 mb-2">Security Boundary</h2>
          <p className="text-zinc-400 text-xs leading-relaxed max-w-xs mb-8">
            The path you requested could not be resolved. It may have been relocated, deleted, or requires higher authentication permissions.
          </p>

          <Link
            href="/"
            className="flex items-center gap-1.5 px-6 py-2.5 rounded-lg text-xs font-semibold bg-white text-zinc-950 hover:bg-zinc-200 transition-all cursor-pointer shadow-lg"
          >
            <ArrowLeft className="w-4 h-4" />
            Return to Safety
          </Link>
        </div>
      </GlassCard>
    </div>
  );
}
