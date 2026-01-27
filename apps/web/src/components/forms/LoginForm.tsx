'use client';

import { useState, FormEvent } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import type { AuthUser } from '@tofa/core';
import { brandConfig } from '@tofa/core';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const userData: AuthUser = await login(email, password);
      // Redirect based on role
      if (userData.role === 'coach') {
        router.push('/coach/dashboard');
      } else {
        router.push('/command-center');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      // Better error handling
      if (err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else if (err.message) {
        setError(err.message);
      } else if (err.code === 'ERR_NETWORK' || err.message?.includes('Network Error')) {
        setError('⚠️ Backend connection failed. Make sure the backend is running on http://127.0.0.1:8000');
      } else {
        setError('Invalid credentials. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 py-12 px-4 sm:px-6 lg:px-8 animate-in fade-in duration-700">
      <div className="max-w-md w-full">
        {/* Premium Login Card */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl border border-yellow-600/30 p-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <Image
              src="/logo.png"
              alt={`${brandConfig.name} Logo`}
              width={120}
              height={120}
              className="object-contain"
              priority
            />
          </div>

          {/* Title */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-black text-white uppercase tracking-tight mb-2">
              TOFA COMMAND CENTER
            </h1>
            <p className="text-sm text-gray-300 font-medium">
              Academy Management System
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-500/20 backdrop-blur-sm border border-red-500/50 text-red-100 px-4 py-3 rounded-lg text-sm font-medium">
                ❌ {error}
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-bold text-white mb-2 uppercase tracking-wide"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Enter your email"
                className="w-full px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg text-white placeholder:text-gray-400 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500/50 outline-none transition-all"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-bold text-white mb-2 uppercase tracking-wide"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
                className="w-full px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg text-white placeholder:text-gray-400 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500/50 outline-none transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-yellow-500 via-amber-600 to-yellow-700 text-tofa-navy font-black py-4 px-6 rounded-lg hover:from-yellow-600 hover:via-amber-700 hover:to-yellow-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl hover:shadow-2xl uppercase tracking-wide text-sm active:scale-95"
            >
              {isLoading ? 'Logging in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

