'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { LogOut, ChevronDown } from 'lucide-react';
import type { User } from '@supabase/supabase-js';

export function AuthButtons() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setMenuOpen(false);
    router.push('/login');
    router.refresh();
  };

  if (loading) {
    return <div className="w-8 h-8 rounded-full bg-surface-tertiary animate-pulse-subtle" />;
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-primary/20 hover:bg-primary-dark hover:shadow-md hover:shadow-primary/25 transition-all duration-200 active:scale-[0.98]"
      >
        Sign In
      </Link>
    );
  }

  const email = user.email || 'User';
  const initials = email
    .split('@')[0]
    .split('.')
    .map((p: string) => p[0]?.toUpperCase())
    .join('')
    .slice(0, 2);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="flex items-center gap-2.5 rounded-xl border border-border hover:border-border-hover bg-white px-3 py-1.5 text-sm transition-all duration-150 hover:shadow-sm"
      >
        <div className="w-7 h-7 rounded-full bg-primary-bg border border-primary-border flex items-center justify-center">
          <span className="text-xs font-bold text-primary">{initials}</span>
        </div>
        <span className="hidden sm:block text-text-secondary font-medium max-w-[140px] truncate">
          {email}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-text-muted transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`} />
      </button>

      {menuOpen && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-border rounded-xl shadow-xl animate-slide-down overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-border-light">
            <p className="text-xs text-text-muted font-medium uppercase tracking-wide">Signed in as</p>
            <p className="text-sm font-medium text-text mt-0.5 truncate">{email}</p>
          </div>
          <div className="p-1.5">
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-danger hover:bg-danger-bg transition-colors duration-150"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
