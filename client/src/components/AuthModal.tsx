import React, { useState } from 'react';
import { User, Lock, Mail, ArrowRight, Sparkles, ShieldCheck, CheckCircle2, AlertCircle, X, Building, Users } from 'lucide-react';
import { registerUser, loginUser, initDemoSession } from '../api/client';
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
      <div className="bg-white rounded-2xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 transition-colors p-1"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200 mb-2">
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            <span>256-Bit Cryptographic Session</span>
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
            onClick={() => { setMode('LOGIN'); setError(null); }}
            className={`py-1.5 rounded-lg transition-all ${mode === 'LOGIN' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'}`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode('REGISTER'); setError(null); }}
            className={`py-1.5 rounded-lg transition-all ${mode === 'REGISTER' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'}`}
          >
            Register
          </button>
          <button
            type="button"
            onClick={() => { setMode('DEMO'); setError(null); }}
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
          <form onSubmit={handleSubmit} className="space-y-4">
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
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
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
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
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
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
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
