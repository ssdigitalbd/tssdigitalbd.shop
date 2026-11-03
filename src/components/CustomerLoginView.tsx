import React, { useState, useEffect } from 'react';
import { User, Lock, Mail, Phone, ArrowRight, AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { api } from '../lib/api.ts';

interface CustomerLoginViewProps {
  onLoginSuccess: (user: any) => void;
  onNavigateHome: () => void;
}

export const CustomerLoginView: React.FC<CustomerLoginViewProps> = ({
  onLoginSuccess,
  onNavigateHome,
}) => {
  const [tab, setTab] = useState<'signin' | 'signup' | 'forgot'>('signin');

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleConfigInfo, setGoogleConfigInfo] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Listen for popup messages from Google OAuth callback
  useEffect(() => {
    const handleAuthMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GOOGLE_AUTH_SUCCESS') {
        if (event.data.token && event.data.user) {
          api.setToken(event.data.token);
          if (onLoginSuccess && typeof onLoginSuccess === 'function') {
            onLoginSuccess(event.data.user);
          }
        }
      } else if (event.data?.type === 'GOOGLE_AUTH_ERROR') {
        setError(event.data.error || 'Google authentication failed.');
      }
    };

    window.addEventListener('message', handleAuthMessage);
    return () => window.removeEventListener('message', handleAuthMessage);
  }, [onLoginSuccess]);

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

      // Open Google OAuth consent directly in popup
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
        setError('Popup was blocked by browser. Please allow popups for this site to sign in with Google.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to initiate Google authentication.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await api.login({ email: email.trim(), password });
      if (!res || !res.user) {
        setError('Login failed: invalid response from authentication service.');
        return;
      }
      onLoginSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your email and password.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
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
      onLoginSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please check your information.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await api.forgotPassword(email.trim());
      setSuccessMsg('If an account exists with this email, password reset instructions have been dispatched.');
    } catch (err: any) {
      setError(err.message || 'Failed to dispatch reset instructions.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12 bg-slate-50">
      <div className="bg-white border border-slate-200 rounded-3xl p-8 sm:p-10 max-w-md w-full shadow-lg">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xs">
            <User className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Customer Account
          </h1>
          <p className="text-xs text-slate-500 mt-1.5">
            Access your purchased subscriptions, license keys, and support tickets.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-100 p-1 rounded-xl mb-6 text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setTab('signin');
              setError(null);
              setSuccessMsg(null);
            }}
            className={`flex-1 py-2 rounded-lg transition-all cursor-pointer ${
              tab === 'signin'
                ? 'bg-white text-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('signup');
              setError(null);
              setSuccessMsg(null);
            }}
            className={`flex-1 py-2 rounded-lg transition-all cursor-pointer ${
              tab === 'signup'
                ? 'bg-white text-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Create Account
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-rose-700 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
            <div className="flex-1 font-medium leading-relaxed">{error}</div>
          </div>
        )}

        {successMsg && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3 text-emerald-800 text-xs">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
            <div className="flex-1 font-medium leading-relaxed">{successMsg}</div>
          </div>
        )}

        {/* Google OAuth Configuration Notice (if pending credentials on server) */}
        {googleConfigInfo && (
          <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 shadow-xs">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1.5 flex-1">
                <p className="font-bold text-amber-950">Google Sign-In Setup Pending</p>
                <p className="text-amber-800 leading-relaxed text-[11px]">
                  Direct Google Login requires server environment credentials. Please configure <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-[10px]">GOOGLE_CLIENT_ID</code> and <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-[10px]">GOOGLE_CLIENT_SECRET</code> in your server/Render settings.
                </p>
                <div className="bg-white/80 p-2 rounded-lg border border-amber-200/80 font-mono text-[10px] text-amber-900 break-all select-all">
                  Redirect URI: {googleConfigInfo.recommendedRedirectUri || 'https://ssdigitalbd.shop/api/auth/google/callback'}
                </div>
                <p className="text-[11px] text-amber-700 font-medium">
                  You can still register or sign in with email and password below.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Official Google Login Button (available for Sign In & Sign Up) */}
        {tab !== 'forgot' && (
          <div className="mb-5">
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
              <span>{googleLoading ? 'Connecting to Google...' : tab === 'signup' ? 'Sign up with Google' : 'Continue with Google'}</span>
            </button>

            <div className="relative flex items-center justify-center my-4">
              <div className="border-t border-slate-200 w-full" />
              <span className="bg-white px-3 text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                or with email
              </span>
            </div>
          </div>
        )}

        {tab === 'signin' && (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setTab('forgot');
                    setError(null);
                  }}
                  className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl text-xs font-bold tracking-wide uppercase shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <span>Signing In...</span>
              ) : (
                <>
                  <span>Sign In to Customer Portal</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {tab === 'signup' && (
          <form onSubmit={handleSignUp} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Tanvir Hossain"
                  className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Phone Number (WhatsApp / SMS)
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+8801XXXXXXXXX"
                  className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Password (min 6 characters)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-3 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl text-xs font-bold tracking-wide uppercase shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? <span>Creating Account...</span> : <span>Create Customer Account</span>}
            </button>
          </form>
        )}

        {tab === 'forgot' && (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Registered Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl text-xs font-bold tracking-wide uppercase shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? <span>Sending...</span> : <span>Send Reset Instructions</span>}
            </button>

            <button
              type="button"
              onClick={() => {
                setTab('signin');
                setError(null);
              }}
              className="w-full text-xs text-slate-500 hover:text-slate-800 font-medium py-1 cursor-pointer"
            >
              Back to Sign In
            </button>
          </form>
        )}

        <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <button
            onClick={onNavigateHome}
            className="hover:text-slate-900 transition-colors flex items-center gap-1.5 font-medium cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Public Marketplace</span>
          </button>
          <span className="font-mono text-[10px] text-slate-400">Encrypted Storage</span>
        </div>
      </div>
    </div>
  );
};
