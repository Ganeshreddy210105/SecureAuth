'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Shield, User, Key, LogOut, LayoutDashboard } from 'lucide-react';
import { removeAccessToken, api } from '@/lib/api';
import { toast } from 'sonner';

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    // Get user info to show in navbar
    const fetchUser = async () => {
      try {
        const res = await api.get('/users/me');
        setEmail(res.data.email);
      } catch (err) {
        // Not logged in or expired
      }
    };
    fetchUser();
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
      toast.success('Logged out successfully');
    } catch (err) {
      // Even if network fails, we clear tokens
    } finally {
      removeAccessToken();
      router.push('/login');
    }
  };

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/profile', label: 'Profile', icon: User },
    { href: '/security', label: 'Security', icon: Key },
  ];

  return (
    <motion.nav 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed top-4 left-4 right-4 z-50 flex items-center justify-between px-6 py-3 rounded-full border border-white/5 bg-[#18181B]/60 backdrop-blur-md max-w-5xl mx-auto shadow-2xl"
    >
      <Link href="/" className="flex items-center gap-2 group">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
          <Shield className="w-4 h-4 text-white" />
        </div>
        <span className="font-bold tracking-tight bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent group-hover:opacity-90">
          SecureAuth
        </span>
      </Link>

      <div className="hidden sm:flex items-center gap-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link 
              key={item.href}
              href={item.href}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 relative ${
                isActive ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {isActive && (
                <motion.div 
                  layoutId="active-nav"
                  className="absolute inset-0 bg-white/5 border border-white/5 rounded-full -z-10"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <item.icon className="w-3.8 h-3.8" />
              {item.label}
            </Link>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        {email && (
          <span className="hidden md:inline text-xs text-zinc-500 font-mono">
            {email}
          </span>
        )}
        <button 
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-zinc-900 border border-white/5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-all cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </motion.nav>
  );
}
