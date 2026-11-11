import React, { useState } from 'react';
import {
  Layers,
  Sparkles,
  CheckSquare,
  BookOpen,
  GitCompare,
  History,
  Settings,
  Users,
  Compass,
  RotateCcw,
  Scale,
  Building,
  FileText,
  LogOut,
  LogIn,
  UserPlus,
  Plus,
  Menu,
  X,
  ShieldCheck,
  ChevronDown,
} from 'lucide-react';
import { Group, UserContext } from '../types';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  groups: Group[];
  selectedGroupId: string;
  setSelectedGroupId: (id: string) => void;
  pendingReviewsCount: number;
  workspaceType: 'PERSONAL' | 'BUSINESS';
  setWorkspaceType: (type: 'PERSONAL' | 'BUSINESS') => void;
  onResetDemo: () => void;
  currentUser: UserContext | null;
  onOpenAuth: (mode?: 'LOGIN' | 'REGISTER' | 'DEMO') => void;
  onLogout: () => void;
  onOpenCreateGroup: () => void;
  onOpenCreateWorkspace: () => void;
  workspaces?: any[];
  selectedWorkspaceId?: string;
  setSelectedWorkspaceId?: (id: string) => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number | string;
  highlight?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  groups,
  selectedGroupId,
  setSelectedGroupId,
  pendingReviewsCount,
  workspaceType,
  setWorkspaceType,
  onResetDemo,
  currentUser,
  onOpenAuth,
  onLogout,
  onOpenCreateGroup,
  onOpenCreateWorkspace,
  workspaces = [],
  selectedWorkspaceId,
  setSelectedWorkspaceId,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const currentGroup = groups.find((g) => g.id === selectedGroupId) || groups[0];
  const isDemo = currentUser?.isDemo || currentUser?.id?.startsWith('user-alex') || currentUser?.id?.startsWith('user-sam') || currentUser?.id?.startsWith('user-agency');

  const personalNavItems: NavItem[] = [
    { id: 'welcome', label: 'Overview', icon: Compass },
    { id: 'dashboard', label: 'Dashboard', icon: Layers },
    { id: 'group', label: 'Group', icon: Users },
    { id: 'ai-import', label: 'AI Import', icon: Sparkles },
    {
      id: 'review-queue',
      label: 'Review Queue',
      icon: CheckSquare,
      badge: pendingReviewsCount > 0 ? pendingReviewsCount : undefined,
    },
    { id: 'ledger', label: 'Ledger', icon: BookOpen },
    { id: 'optimizer', label: 'Optimizer', icon: Scale },
    {
      id: 'reconciliation',
      label: 'Reconciliation',
      icon: GitCompare,
      highlight: true,
    },
    { id: 'audit', label: 'Audit Trail', icon: History },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const businessNavItems: NavItem[] = [
    { id: 'welcome', label: 'Overview', icon: Compass },
    { id: 'invoices', label: 'Invoices & Clients', icon: FileText, highlight: true },
    { id: 'ai-import', label: 'AI OCR Parser', icon: Sparkles },
    { id: 'reconciliation', label: 'Reconciliation Audit', icon: GitCompare },
    { id: 'audit', label: 'Cryptographic Audit', icon: History },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const navItems = workspaceType === 'BUSINESS' ? businessNavItems : personalNavItems;

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      {/* Top Banner: Product Tagline & Mode Status */}
      <div className="bg-slate-900 text-white text-[11px] py-1.5 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-200">ClearSettle:</span>
          <span className="text-slate-400 hidden sm:inline">"Connecting obligation, ledger math, PayPal capture, and net proceeds."</span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {isDemo ? (
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
              <span>DEMO DATASET (TOKYO & APEX)</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-mono text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span>LIVE USER ACCOUNT</span>
            </div>
          )}

          <span className="hidden md:inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
            PayPal Sandbox
          </span>

          {isDemo && (
            <button
              onClick={onResetDemo}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors text-[10px]"
              title="Reset demo data to initial Tokyo & Munich trip"
            >
              <RotateCcw className="w-3 h-3" />
              <span className="hidden sm:inline">Reset Baseline</span>
            </button>
          )}

          <button
            onClick={() => onOpenAuth('DEMO')}
            className="text-[10px] text-indigo-300 hover:text-white underline underline-offset-2 ml-1"
          >
            Switch Persona
          </button>
        </div>
      </div>

      {/* Main Header Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Identity: cs.ai */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('welcome')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-900 to-indigo-950 flex items-center justify-center text-white shadow-md ring-1 ring-slate-800/80 group">
              <span className="font-black text-sm tracking-tight flex items-center">
                cs<span className="text-emerald-400 font-bold">.ai</span>
              </span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-slate-900 text-base tracking-tight flex items-center">
                  cs<span className="text-emerald-600 font-extrabold">.ai</span>
                </span>
                <span className="text-xs text-slate-300 font-light">|</span>
                <span className="text-xs font-semibold text-slate-700">ClearSettle</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Fintech Core
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">Obligation Ledger & Payment Reconciliation</p>
            </div>
          </div>

          {/* Segment Selector & Workspace Controls */}
          <div className="hidden lg:flex items-center gap-3">
            {/* Customer Segment Toggle Pill */}
            <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200 text-xs font-semibold">
              <button
                onClick={() => {
                  setWorkspaceType('PERSONAL');
                  if (activeTab === 'invoices') setActiveTab('dashboard');
                }}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                  workspaceType === 'PERSONAL'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-indigo-600" />
                <span>Personal Groups</span>
              </button>
              <button
                onClick={() => {
                  setWorkspaceType('BUSINESS');
                  if (activeTab === 'dashboard' || activeTab === 'group' || activeTab === 'ledger' || activeTab === 'optimizer') {
                    setActiveTab('invoices');
                  }
                }}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                  workspaceType === 'BUSINESS'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Building className="w-3.5 h-3.5 text-amber-600" />
                <span>Small Business</span>
              </button>
            </div>

            {/* Active Group / Workspace Selector */}
            {workspaceType === 'PERSONAL' ? (
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs">
                <span className="text-slate-400 font-medium">Group:</span>
                {groups.length > 0 ? (
                  <select
                    value={selectedGroupId}
                    onChange={(e) => setSelectedGroupId(e.target.value)}
                    className="bg-transparent font-medium text-slate-800 focus:outline-none cursor-pointer max-w-[140px] truncate"
                  >
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-slate-400 italic">No groups yet</span>
                )}
                <button
                  onClick={onOpenCreateGroup}
                  className="p-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 transition-colors ml-1"
                  title="Create New Group"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs">
                <span className="text-slate-400 font-medium">Workspace:</span>
                {workspaces.length > 0 ? (
                  <select
                    value={selectedWorkspaceId || workspaces[0]?.id}
                    onChange={(e) => setSelectedWorkspaceId && setSelectedWorkspaceId(e.target.value)}
                    className="bg-transparent font-medium text-slate-800 focus:outline-none cursor-pointer max-w-[140px] truncate"
                  >
                    {workspaces.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-slate-400 italic">No workspace yet</span>
                )}
                <button
                  onClick={onOpenCreateWorkspace}
                  className="p-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 transition-colors ml-1"
                  title="Create New Workspace"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            )}

            <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-xs font-mono text-slate-700">
              <span className="text-slate-400">Base:</span>
              <span className="font-semibold">{currentGroup?.baseCurrency || 'EUR'}</span>
            </div>
          </div>

          {/* User Account Controls */}
          <div className="hidden sm:flex items-center gap-2">
            {currentUser ? (
              <div className="relative">
                <button
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center gap-2 p-1.5 pr-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs uppercase">
                    {currentUser.name.slice(0, 2)}
                  </div>
                  <div className="hidden md:block">
                    <div className="text-xs font-bold text-slate-900 leading-tight truncate max-w-[110px]">
                      {currentUser.name}
                    </div>
                    <div className="text-[10px] text-slate-400 leading-none truncate max-w-[110px]">
                      {currentUser.email}
                    </div>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {userDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-xs">
                    <div className="px-3 py-2 border-b border-slate-100">
                      <div className="font-bold text-slate-900">{currentUser.name}</div>
                      <div className="text-slate-500 text-[11px] truncate">{currentUser.email}</div>
                      <div className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-slate-100 text-slate-700">
                        Role: {currentUser.role}
                      </div>
                    </div>
                    <button
                      onClick={() => { onOpenCreateGroup(); setUserDropdownOpen(false); }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                    >
                      <Plus className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Create New Expense Group</span>
                    </button>
                    <button
                      onClick={() => { onOpenCreateWorkspace(); setUserDropdownOpen(false); }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                    >
                      <Plus className="w-3.5 h-3.5 text-amber-600" />
                      <span>Create Business Workspace</span>
                    </button>
                    <button
                      onClick={() => { onOpenAuth('DEMO'); setUserDropdownOpen(false); }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700 border-t border-slate-100"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                      <span>Switch Demo Persona</span>
                    </button>
                    <button
                      onClick={() => { onLogout(); setUserDropdownOpen(false); }}
                      className="w-full text-left px-3 py-2 hover:bg-rose-50 flex items-center gap-2 text-rose-700 border-t border-slate-100"
                    >
                      <LogOut className="w-3.5 h-3.5 text-rose-600" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onOpenAuth('LOGIN')}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </button>
                <button
                  onClick={() => onOpenAuth('REGISTER')}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Register</span>
                </button>
              </div>
            )}
          </div>

          {/* Mobile menu hamburger */}
          <div className="flex lg:hidden items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden py-3 border-t border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200 text-xs font-semibold">
                <button
                  onClick={() => { setWorkspaceType('PERSONAL'); setMobileMenuOpen(false); }}
                  className={`px-3 py-1 rounded-lg ${workspaceType === 'PERSONAL' ? 'bg-white shadow-xs' : 'text-slate-600'}`}
                >
                  Personal
                </button>
                <button
                  onClick={() => { setWorkspaceType('BUSINESS'); setMobileMenuOpen(false); }}
                  className={`px-3 py-1 rounded-lg ${workspaceType === 'BUSINESS' ? 'bg-white shadow-xs' : 'text-slate-600'}`}
                >
                  Business
                </button>
              </div>

              {!currentUser ? (
                <button
                  onClick={() => { onOpenAuth('LOGIN'); setMobileMenuOpen(false); }}
                  className="px-3 py-1 rounded-lg bg-slate-900 text-white text-xs font-medium"
                >
                  Sign In
                </button>
              ) : (
                <button
                  onClick={() => { onLogout(); setMobileMenuOpen(false); }}
                  className="px-3 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-xs font-medium"
                >
                  Sign Out
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                onClick={() => { onOpenCreateGroup(); setMobileMenuOpen(false); }}
                className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 text-center font-medium"
              >
                + New Group
              </button>
              <button
                onClick={() => { onOpenCreateWorkspace(); setMobileMenuOpen(false); }}
                className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 text-center font-medium"
              >
                + New Workspace
              </button>
            </div>
          </div>
        )}

        {/* Tab Navigation Menu */}
        <nav className="flex space-x-1 overflow-x-auto py-1.5 border-t border-slate-100 scrollbar-none">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                } ${item.highlight && !isActive ? 'border border-indigo-200 bg-indigo-50/50 text-indigo-900' : ''}`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : item.highlight ? 'text-indigo-600' : 'text-slate-500'}`} />
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span
                    className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      isActive ? 'bg-amber-400 text-slate-950' : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
                {item.highlight && !isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
