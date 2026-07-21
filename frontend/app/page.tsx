'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Shield, Key, RefreshCw, Smartphone, Laptop, Users, ArrowRight } from 'lucide-react';
import GlassCard from '@/components/ui/GlassCard';

export default function LandingPage() {
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 80 } },
  };

  const features = [
    {
      title: 'OAuth2 & Social Logins',
      desc: 'Seamless Google and GitHub authentication out of the box with auto-linking.',
      icon: Users,
      color: 'from-blue-500 to-indigo-500',
    },
    {
      title: 'Session Rotation',
      desc: 'Access + refresh token rotation with automated reuse detection for ironclad theft protection.',
      icon: RefreshCw,
      color: 'from-purple-500 to-pink-500',
    },
    {
      title: 'Passwordless OTP',
      desc: 'Secure 6-digit email codes for login and email validation with strict cooldown limits.',
      icon: Smartphone,
      color: 'from-cyan-500 to-teal-500',
    },
    {
      title: 'Device & Session Audit',
      desc: 'Real-time dashboard audit logs displaying active browser sessions and device IP addresses.',
      icon: Laptop,
      color: 'from-violet-500 to-fuchsia-500',
    },
  ];

  return (
    <div className="w-full max-w-5xl px-4 py-20 flex flex-col items-center justify-center min-h-screen">
      {/* Hero Section */}
      <motion.div 
        initial={{ opacity: 0, y: -25 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="text-center max-w-3xl mb-16"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 mb-6 backdrop-blur-sm">
          <Shield className="w-4 h-4 text-purple-400" />
          <span className="text-xs font-semibold text-zinc-300 tracking-wide">
            INTRODUCING SECUREAUTH Identity Cloud
          </span>
        </div>
        
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight mb-6 leading-tight">
          Next-Gen Identity. <br />
          <span className="bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
            Apple-Quality Experience.
          </span>
        </h1>
        
        <p className="text-zinc-400 text-lg sm:text-xl leading-relaxed mb-8 max-w-2xl mx-auto">
          An enterprise-grade JWT + OAuth2 authentication platform offering passwordless workflows, token rotation, and interactive sessions.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link 
            href="/login"
            className="flex items-center gap-2 px-8 py-3.5 rounded-full font-bold bg-white text-zinc-950 hover:bg-zinc-200 transition-all duration-200 shadow-xl cursor-pointer w-full sm:w-auto justify-center"
          >
            Get Started
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link 
            href="/register"
            className="px-8 py-3.5 rounded-full font-bold bg-[#18181B] border border-white/10 text-zinc-200 hover:bg-zinc-800 transition-all duration-200 cursor-pointer w-full sm:w-auto justify-center"
          >
            Create Account
          </Link>
        </div>
      </motion.div>

      {/* Feature Grid */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mt-8"
      >
        {features.map((feature, i) => (
          <motion.div key={i} variants={itemVariants} className="flex h-full">
            <div className="glass-panel hover:border-purple-500/30 rounded-2xl p-6 sm:p-8 flex gap-5 items-start transition-all duration-300 w-full glow-on-hover">
              <div className={`p-3 rounded-xl bg-gradient-to-br ${feature.color} shadow-lg shrink-0`}>
                <feature.icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
