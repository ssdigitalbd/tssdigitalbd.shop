/**
 * Customer Authentication Modal
 * Real Registration, Login, Forgot Password, and Google OAuth Management.
 */

import React, { useState, useEffect } from 'react';
import { api } from '../lib/api.ts';
import {
  Lock,
  Mail,
  User,
  Phone,
  X,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

interface CustomerAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: any) => void;
  initialMode?: 'login' | 'register';
}

export const CustomerAuthModal: React.FC<CustomerAuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
  initialMode = 'login',
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(initialMode);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleConfigInfo, setGoogleConfigInfo] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const handleAuthMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GOOGLE_AUTH_SUCCESS') {
        if (event.data.token && event.data.user) {
          api.setToken(event.data.token);
          if (onAuthSuccess && typeof onAuthSuccess === 'function') {
            onAuthSuccess(event.data.user);
          }
          onClose();
        }
      } else if (event.data?.type === 'GOOGLE_AUTH_ERROR') {
        setError(event.data.error || 'Google authentication failed.');
      }
    };

    window.addEventListener('message', handleAuthMessage);
    return () => window.removeEventListener('message', handleAuthMessage);
  }, [onAuthSuccess, onClose]);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setError(null);
    setGoogleConfigInfo(null);
    setGoogleLoading(true);

    try {
      const res = await api.getGoogleAuthUrl();
      if (!res.configured || !res.url) {
        setGoogleConfigInfo(
          res.instructions || {
            recommendedRedirectUri: res.redirectUri || `${window.location.origin}/api/auth/google/callback`,
          }
        );
        return;
      }

      const width = 500;
      const height = 620;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      const popup = window.open(
        res.url,
        'google_oauth_popup',
        `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes,scrollbars=yes`
      );

      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        setError('Popup was blocked by your browser. Please allow popups for this site to sign in with Google.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to initiate Google authentication.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await api.login({ email: email.trim(), password });
      if (!res || !res.user) {
        setError('Login failed: invalid response from authentication service.');
        return;
      }
      onAuthSuccess(res.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.register({
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
      });
      if (!res || !res.user) {
        setError('Registration failed: no user profile created.');
        return;
      }
      onAuthSuccess(res.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await api.forgotPassword(email.trim());
      setSuccessMsg(res.message || 'Recovery email has been sent.');
    } catch (err: any) {
      setError(err.message || 'Password reset request failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-2xl animate-in fade-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {mode === 'login' && 'Sign In to SSDigitalBD.shop'}
                {mode === 'register' && 'Create Customer Account'}
                {mode === 'forgot' && 'Reset Your Password'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {mode === 'login' && 'Access your digital subscriptions & credentials'}
                {mode === 'register' && 'Unlock instant delivery & lifetime warranty'}
                {mode === 'forgot' && 'We will send a secure reset link to your email'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        {mode !== 'forgot' && (
          <div className="flex bg-slate-100 p-1 rounded-xl my-4 text-xs font-semibold text-slate-600">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
                setGoogleConfigInfo(null);
              }}
              className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                mode === 'login' ? 'bg-white text-slate-900 shadow-2xs' : 'hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
                setGoogleConfigInfo(null);
              }}
              className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                mode === 'register' ? 'bg-white text-slate-900 shadow-2xs' : 'hover:text-slate-900'
              }`}
            >
              Register
            </button>
          </div>
        )}

        {/* Feedback Messages */}
        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Google OAuth Configuration Notice */}
        {googleConfigInfo && (
          <div className="mb-4 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 shadow-xs">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-amber-950">Google Sign-In Pending Configuration</p>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Requires server environment variables <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-[10px]">GOOGLE_CLIENT_ID</code> and <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-[10px]">GOOGLE_CLIENT_SECRET</code>.
                </p>
                <div className="bg-white/80 p-1.5 rounded border border-amber-200 text-[10px] font-mono break-all select-all">
                  Callback: {googleConfigInfo.recommendedRedirectUri || 'https://ssdigitalbd.shop/api/auth/google/callback'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Google OAuth Button */}
        {mode !== 'forgot' && (
          <div className="mb-4">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
              className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-300 hover:border-slate-400 text-slate-700 rounded-xl text-xs font-semibold shadow-2xs hover:shadow-xs transition-all flex items-center justify-center gap-3 cursor-pointer"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>{googleLoading ? 'Connecting to Google...' : mode === 'register' ? 'Sign up with Google' : 'Continue with Google'}</span>
            </button>

            <div className="relative flex items-center justify-center my-3.5">
              <div className="border-t border-slate-200 w-full" />
              <span className="bg-white px-2.5 text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                or with email
              </span>
            </div>
          </div>
        )}

        {/* Form: LOGIN */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-3.5">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@gmail.com"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot');
                    setError(null);
                  }}
                  className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors mt-2 flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        )}

        {/* Form: REGISTER */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Full Name *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Tanvir Hossain"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Email Address *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="customer@gmail.com"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Mobile Number (bKash/Nagad/WhatsApp) *
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="017XXXXXXXX"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Password *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 6 chars"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Confirm *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors mt-2 flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? 'Registering Account...' : 'Create Account'}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        )}

        {/* Form: FORGOT PASSWORD */}
        {mode === 'forgot' && (
          <form onSubmit={handleForgotPassword} className="space-y-4 my-2">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Enter your account email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@gmail.com"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              {loading ? 'Sending Instructions...' : 'Send Password Reset Code'}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                  setSuccessMsg(null);
                }}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer"
              >
                ← Return to Sign In
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
