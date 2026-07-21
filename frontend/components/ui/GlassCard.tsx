'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export default function GlassCard({ children, className = '', delay = 0 }: GlassCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ 
        duration: 0.5, 
        delay, 
        type: 'spring',
        stiffness: 100,
        damping: 15
      }}
      className={`glass-panel glow-on-hover rounded-2xl p-6 sm:p-8 w-full max-w-md ${className}`}
    >
      {children}
    </motion.div>
  );
}
