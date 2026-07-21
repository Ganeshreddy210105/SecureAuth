'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const Background3D = dynamic(() => import('./Background3D'), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-[#09090B] -z-10" />
});

export default function ClientBackground() {
  return <Background3D />;
}
