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
  onNavigate?: (path: string) => void;
  onOpenTrackModal: () => void;
  onOpenApplyModal: () => void;
  onOpenAuthModal?: () => void;
  currentUser?: any;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onNavigate,
  onOpenTrackModal,
  onOpenApplyModal,
  onOpenAuthModal,
  currentUser,
  onLogout,
}) => {
  const handleNav = (tab: ActiveTab, path: string) => {
    setActiveTab(tab);
    if (onNavigate) {
      onNavigate(path);
    }
  };
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-6 px-6 py-3.5">
        {/* Zone 1: Brand Wordmark (Single text element) */}
        <button
          onClick={() => handleNav('main_store', '/')}
          className="text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 hover:text-indigo-600 transition-colors text-left cursor-pointer"
        >
          SSDigitalBD.shop
        </button>

        {/* Zone 2: Concise Single-Line Nav Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <button
            onClick={() => handleNav('main_store', '/')}
            className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              activeTab === 'main_store'
                ? 'text-indigo-600 font-semibold'
                : 'hover:text-slate-900'
            }`}
          >
            Storefront
          </button>

          <button
            onClick={() => handleNav('customer_portal', '/customer')}
            className={`whitespace-nowrap shrink-0 transition-colors flex items-center gap-1.5 cursor-pointer ${
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
            className="whitespace-nowrap shrink-0 hover:text-slate-900 transition-colors cursor-pointer"
          >
            Track Order
          </button>

          <button
            onClick={onOpenApplyModal}
            className="whitespace-nowrap shrink-0 hover:text-slate-900 transition-colors cursor-pointer"
          >
            Apply Reseller
          </button>

          {currentUser?.role === 'admin' && (
            <button
              onClick={() => handleNav('admin_portal', '/admin')}
              className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                activeTab === 'admin_portal'
                  ? 'text-indigo-600 font-semibold'
                  : 'hover:text-slate-900'
              }`}
            >
              Admin Console
            </button>
          )}

          {currentUser?.role === 'reseller' && (
            <button
              onClick={() => handleNav('reseller_portal', '/reseller')}
              className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                activeTab === 'reseller_portal'
                  ? 'text-indigo-600 font-semibold'
                  : 'hover:text-slate-900'
              }`}
            >
              Reseller Portal
            </button>
          )}
        </nav>

        {/* Zone 3: Actions & Auth */}
        <div className="flex items-center gap-3 shrink-0">
          {currentUser ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (currentUser.role === 'admin') handleNav('admin_portal', '/admin');
                  else if (currentUser.role === 'reseller') handleNav('reseller_portal', '/reseller');
                  else handleNav('customer_portal', '/customer');
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                <User className="w-3.5 h-3.5 text-indigo-600" />
                <span className="truncate max-w-[100px]">{currentUser.fullName?.split(' ')[0] || 'Account'}</span>
                <span className="ml-1 text-[10px] font-mono uppercase bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                  {currentUser.role}
                </span>
              </button>
              {onLogout && (
                <button
                  onClick={onLogout}
                  title="Log out"
                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={() => handleNav('customer_portal', '/customer')}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors whitespace-nowrap cursor-pointer"
            >
              Sign In / Register
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

