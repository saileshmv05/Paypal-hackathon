import React, { useState, useEffect, useRef } from 'react';
import { User, Lock, Mail, ArrowRight, Sparkles, ShieldCheck, CheckCircle2, AlertCircle, X, Building, Users } from 'lucide-react';
import { registerUser, loginUser, initDemoSession, getGoogleAuthConfig, loginWithGoogle } from '../api/client';
import { UserContext } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: UserContext) => void;
  initialMode?: 'LOGIN' | 'REGISTER' | 'DEMO';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
  initialMode = 'LOGIN',
}) => {
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER' | 'DEMO'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleConfig, setGoogleConfig] = useState<{ clientId: string; enabled: boolean; mode: string }>({
    clientId: '',
    enabled: false,
    mode: 'DEMO_READY',
  });
  const [showGooglePrompt, setShowGooglePrompt] = useState(false);
  const [googleEmailInput, setGoogleEmailInput] = useState('maya.lin.google@gmail.com');
  const googleBtnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getGoogleAuthConfig().then((cfg) => {
      setGoogleConfig(cfg);
    });
  }, []);

  // Initialize official Google Identity Services button if real client ID is present
  useEffect(() => {
    let checkTimer: any = null;
    let attempts = 0;

    const initGsi = () => {
      attempts++;
      if (googleConfig.enabled && googleConfig.clientId && (window as any).google?.accounts?.id && googleBtnRef.current) {
        try {
          (window as any).google.accounts.id.initialize({
            client_id: googleConfig.clientId,
            callback: async (response: any) => {
              if (response.credential) {
                setLoading(true);
                setError(null);
                try {
                  const res = await loginWithGoogle({ credential: response.credential });
                  onAuthSuccess(res.user);
                  onClose();
                } catch (err: any) {
                  setError(err.message || 'Google Sign-In failed');
                } finally {
                  setLoading(false);
                }
              }
            },
          });
          if (googleBtnRef.current) {
            googleBtnRef.current.innerHTML = '';
            (window as any).google.accounts.id.renderButton(googleBtnRef.current, {
              theme: 'outline',
              size: 'large',
              width: 360,
              text: mode === 'REGISTER' ? 'signup_with' : 'signin_with',
            });
          }
          if (checkTimer) clearInterval(checkTimer);
        } catch (e) {
          console.warn('Google GSI initialization notice:', e);
        }
      } else if (attempts > 10 && checkTimer) {
        clearInterval(checkTimer);
      }
    };

    initGsi();
    checkTimer = setInterval(initGsi, 300);
    return () => {
      if (checkTimer) clearInterval(checkTimer);
    };
  }, [googleConfig, mode, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'REGISTER') {
        if (!name.trim()) throw new Error('Please enter your full name.');
        if (!email.trim() || !email.includes('@')) throw new Error('Please enter a valid email address.');
        if (password.length < 6) throw new Error('Password must be at least 6 characters.');

        const res = await registerUser(name, email, password);
        onAuthSuccess(res.user);
        onClose();
      } else if (mode === 'LOGIN') {
        if (!email.trim() || !password) throw new Error('Please enter both email and password.');

        const res = await loginUser(email, password);
        onAuthSuccess(res.user);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleClick = async () => {
    setError(null);
    if (googleConfig.enabled && (window as any).google?.accounts?.id) {
      try {
        (window as any).google.accounts.id.prompt();
        return;
      } catch (err) {
        console.warn('Google prompt fallback:', err);
      }
    }
    // If no client ID configured yet in .env, toggle friendly one-click Google identity modal
    setShowGooglePrompt(true);
  };

  const handleExecuteGoogleDemo = async (customEmail: string) => {
    setError(null);
    setLoading(true);
    try {
      const res = await loginWithGoogle({
        demo: true,
        email: customEmail,
        name: customEmail.split('@')[0].replace('.', ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      });
      onAuthSuccess(res.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Google login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoPersona = async (persona: string) => {
    setError(null);
    setLoading(true);
    try {
      const res = await initDemoSession(persona);
      onAuthSuccess({ ...res.user, isDemo: true });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to initialize demo session');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-5 relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 transition-colors p-1"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200 mb-1">
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            <span>256-Bit Cryptographic Session & OAuth 2.0</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            {mode === 'REGISTER' && 'Create Your ClearSettle Account'}
            {mode === 'LOGIN' && 'Sign in to ClearSettle'}
            {mode === 'DEMO' && 'Select a Pre-Seeded Demo Persona'}
          </h2>
          <p className="text-xs text-slate-500">
            {mode === 'REGISTER' && 'Start fresh with your own private multi-currency group or business workspace.'}
            {mode === 'LOGIN' && 'Access your private expense ledgers, invoices, and reconciliation audits.'}
            {mode === 'DEMO' && 'Test the platform immediately with realistic pre-configured datasets.'}
          </p>
        </div>

        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-3 p-1 rounded-xl bg-slate-100 text-xs font-semibold text-slate-600">
          <button
            type="button"
            onClick={() => { setMode('LOGIN'); setError(null); setShowGooglePrompt(false); }}
            className={`py-1.5 rounded-lg transition-all ${mode === 'LOGIN' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'}`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode('REGISTER'); setError(null); setShowGooglePrompt(false); }}
            className={`py-1.5 rounded-lg transition-all ${mode === 'REGISTER' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'}`}
          >
            Register
          </button>
          <button
            type="button"
            onClick={() => { setMode('DEMO'); setError(null); setShowGooglePrompt(false); }}
            className={`py-1.5 rounded-lg transition-all ${mode === 'DEMO' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'}`}
          >
            Demo Mode
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Google Authentication Trigger */}
        {mode !== 'DEMO' && (
          <div className="space-y-3">
            {/* Google GSI container or Native Button */}
            <div ref={googleBtnRef} className="w-full flex justify-center">
              <button
                type="button"
                onClick={handleGoogleClick}
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all shadow-xs flex items-center justify-center gap-2.5"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>
            </div>

            {/* Google Fast Simulator Prompt (for evaluation when GOOGLE_CLIENT_ID is not configured in .env) */}
            {showGooglePrompt && !googleConfig.enabled && (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2.5 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">Google OAuth Identity Selector:</span>
                  <span className="text-[10px] text-slate-500 font-mono">Sandbox Demo</span>
                </div>
                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => handleExecuteGoogleDemo('maya.lin.google@gmail.com')}
                    className="w-full text-left px-3 py-2 rounded-lg bg-white border border-slate-200 hover:border-indigo-400 text-xs text-slate-700 font-medium flex items-center justify-between"
                  >
                    <span>Maya Lin (maya.lin.google@gmail.com)</span>
                    <span className="text-[10px] text-emerald-600 font-bold">1-Click</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExecuteGoogleDemo('alex.chen.google@gmail.com')}
                    className="w-full text-left px-3 py-2 rounded-lg bg-white border border-slate-200 hover:border-indigo-400 text-xs text-slate-700 font-medium flex items-center justify-between"
                  >
                    <span>Alex Chen (alex.chen.google@gmail.com)</span>
                    <span className="text-[10px] text-emerald-600 font-bold">1-Click</span>
                  </button>
                </div>
                <div className="flex gap-1.5 pt-1">
                  <input
                    type="email"
                    value={googleEmailInput}
                    onChange={(e) => setGoogleEmailInput(e.target.value)}
                    placeholder="or custom @gmail.com"
                    className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => handleExecuteGoogleDemo(googleEmailInput)}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold"
                  >
                    Sign In
                  </button>
                </div>
                <p className="text-[10px] text-slate-400">
                  Tip: Set <code className="text-slate-600 font-mono">GOOGLE_CLIENT_ID</code> in <code className="text-slate-600 font-mono">.env</code> to activate live Google Cloud popup.
                </p>
              </div>
            )}

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink mx-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Or with email
              </span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>
          </div>
        )}

        {/* Forms */}
        {mode === 'DEMO' ? (
          <div className="space-y-3 pt-1">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Choose a Persona:</div>
            
            <button
              type="button"
              onClick={() => handleDemoPersona('alex-organizer')}
              disabled={loading}
              className="w-full text-left p-3.5 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/40 transition-all flex items-start gap-3 group"
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 mt-0.5">
                <Users className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">Alex (Organizer & Admin)</span>
                  <span className="text-[10px] font-mono text-indigo-600 font-semibold">Full Access</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">Tokyo & Munich travel group + Apex Creative Agency</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleDemoPersona('sam-member')}
              disabled={loading}
              className="w-full text-left p-3.5 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/40 transition-all flex items-start gap-3 group"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                <User className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">Sam (Travel Participant)</span>
                  <span className="text-[10px] font-mono text-emerald-600 font-semibold">Group Only</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">Participant in Tokyo & Munich trip (EUR/USD)</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleDemoPersona('agency-owner')}
              disabled={loading}
              className="w-full text-left p-3.5 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/40 transition-all flex items-start gap-3 group"
            >
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                <Building className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">Elena (Apex Agency Owner)</span>
                  <span className="text-[10px] font-mono text-amber-600 font-semibold">B2B Workspace</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">Commercial invoices & PayPal seller fee audits</p>
              </div>
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === 'REGISTER' && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Full Name</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Maya Lin"
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. maya@example.com"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>{mode === 'REGISTER' ? 'Create Account & Start' : 'Sign In to Account'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>
        )}

        <div className="pt-2 border-t border-slate-100 text-center">
          <p className="text-[11px] text-slate-400">
            {mode === 'REGISTER' && 'Already registered? '}
            {mode === 'LOGIN' && "Don't have an account yet? "}
            {mode === 'DEMO' && 'Want to use your own private data? '}
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'REGISTER' ? 'LOGIN' : 'REGISTER');
                setError(null);
                setShowGooglePrompt(false);
              }}
              className="text-indigo-600 hover:text-indigo-800 font-semibold"
            >
              {mode === 'REGISTER' ? 'Sign in here' : 'Register a new account'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
