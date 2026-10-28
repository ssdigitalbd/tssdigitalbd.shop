/**
 * Navbar adhering strictly to the Top Bar Contract (Section 2)
 * [Brand title, one line] — [4–5 nav links, 1–2 word labels, single-line] — [1 primary action]
 */

import React from 'react';
import { User, LogOut, Package } from 'lucide-react';

export type ActiveTab = 'main_store' | 'reseller_storefront' | 'reseller_portal' | 'admin_portal' | 'customer_portal';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenTrackModal: () => void;
  onOpenApplyModal: () => void;
  onOpenAuthModal?: () => void;
  currentUser?: any;
  onLogout?: () => void;
  currentRole: 'customer' | 'reseller' | 'admin';
  onChangeRole: (role: 'customer' | 'reseller' | 'admin') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenTrackModal,
  onOpenApplyModal,
  onOpenAuthModal,
  currentUser,
  onLogout,
  currentRole,
  onChangeRole,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-6 px-6 py-3.5">
        {/* Zone 1: Brand Wordmark (Single text element) */}
        <button
          onClick={() => setActiveTab('main_store')}
          className="text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 hover:text-indigo-600 transition-colors text-left"
        >
          SSDigitalBD.shop
        </button>

        {/* Zone 2: 4-5 Concise Single-Line Nav Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <button
            onClick={() => setActiveTab('main_store')}
            className={`whitespace-nowrap shrink-0 transition-colors ${
              activeTab === 'main_store'
                ? 'text-indigo-600 font-semibold'
                : 'hover:text-slate-900'
            }`}
          >
            Storefront
          </button>

          <button
            onClick={() => setActiveTab('customer_portal')}
            className={`whitespace-nowrap shrink-0 transition-colors flex items-center gap-1.5 ${
              activeTab === 'customer_portal'
                ? 'text-indigo-600 font-semibold'
                : 'hover:text-slate-900'
            }`}
          >
            <Package className="w-4 h-4" />
            My Services
          </button>

          <button
            onClick={onOpenTrackModal}
            className="whitespace-nowrap shrink-0 hover:text-slate-900 transition-colors"
          >
            Track Order
          </button>

          <button
            onClick={onOpenApplyModal}
            className="whitespace-nowrap shrink-0 hover:text-slate-900 transition-colors"
          >
            Apply Reseller
          </button>

          <button
            onClick={() => {
              if (currentRole === 'admin') setActiveTab('admin_portal');
              else if (currentRole === 'reseller') setActiveTab('reseller_portal');
              else setActiveTab('customer_portal');
            }}
            className={`whitespace-nowrap shrink-0 transition-colors ${
              activeTab === 'reseller_portal' || activeTab === 'admin_portal'
                ? 'text-indigo-600 font-semibold'
                : 'hover:text-slate-900'
            }`}
          >
            Portal Dashboard
          </button>
        </nav>

        {/* Zone 3: Actions & Auth */}
        <div className="flex items-center gap-3 shrink-0">
          {currentUser ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('customer_portal')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition-colors"
              >
                <User className="w-3.5 h-3.5 text-indigo-600" />
                <span className="truncate max-w-[100px]">{currentUser.fullName?.split(' ')[0] || 'Account'}</span>
              </button>
              {onLogout && (
                <button
                  onClick={onLogout}
                  title="Log out"
                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          ) : (
            onOpenAuthModal && (
              <button
                onClick={onOpenAuthModal}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors whitespace-nowrap"
              >
                Sign In / Register
              </button>
            )
          )}

          {/* Quick Role View Switcher */}
          <div className="hidden lg:flex items-center bg-slate-100 p-1 rounded-lg text-xs font-medium text-slate-600 border border-slate-200">
            <button
              onClick={() => {
                onChangeRole('customer');
                setActiveTab('customer_portal');
              }}
              className={`px-2.5 py-1 rounded-md transition-all whitespace-nowrap ${
                currentRole === 'customer'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'hover:text-slate-900'
              }`}
            >
              Customer
            </button>
            <button
              onClick={() => {
                onChangeRole('reseller');
                setActiveTab('reseller_portal');
              }}
              className={`px-2.5 py-1 rounded-md transition-all whitespace-nowrap ${
                currentRole === 'reseller'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'hover:text-slate-900'
              }`}
            >
              Reseller
            </button>
            <button
              onClick={() => {
                onChangeRole('admin');
                setActiveTab('admin_portal');
              }}
              className={`px-2.5 py-1 rounded-md transition-all whitespace-nowrap ${
                currentRole === 'admin'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'hover:text-slate-900'
              }`}
            >
              Admin
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

