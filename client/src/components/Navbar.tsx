import React from 'react';
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
} from 'lucide-react';
import { Group } from '../types';

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
}) => {
  const currentGroup = groups.find((g) => g.id === selectedGroupId) || groups[0];

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
          <span className="text-slate-400">"Know what your group owes. See what payments actually cost."</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono text-[10px]">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
            PayPal Sandbox Checkout Active
          </span>
          <button
            onClick={onResetDemo}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors text-[10px]"
            title="Reset demo data to initial Tokyo & Munich trip"
          >
            <RotateCcw className="w-3 h-3" />
            Reset Demo Dataset
          </button>
        </div>
      </div>

      {/* Main Header Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Identity */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('welcome')}>
            <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-sm ring-1 ring-slate-800">
              <span className="font-bold text-lg tracking-tight">CS</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-base tracking-tight">ClearSettle</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Fintech Engine
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">Multicurrency Group Reconciliation</p>
            </div>
          </div>

          {/* Segment Selector & Workspace Controls */}
          <div className="flex items-center gap-3">
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
                <span>Personal Travel</span>
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

            {workspaceType === 'PERSONAL' ? (
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs">
                <span className="text-slate-500 font-medium">Group:</span>
                <select
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  className="bg-transparent font-medium text-slate-800 focus:outline-none cursor-pointer"
                >
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs">
                <span className="text-slate-500 font-medium">Agency:</span>
                <span className="font-semibold text-slate-800">Apex Creative Studios</span>
              </div>
            )}

            <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-xs font-mono text-slate-700">
              <span className="text-slate-400">Base:</span>
              <span className="font-semibold">{currentGroup?.baseCurrency || 'EUR'}</span>
              <span>🇪🇺</span>
            </div>
          </div>
        </div>

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

