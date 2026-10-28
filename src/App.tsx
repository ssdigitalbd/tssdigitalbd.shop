/**
 * DigiMarket Master Application
 * Production Digital Marketplace, Reseller Stores, Wholesale Ledger & Admin Consoles.
 *
 * Implements strict domain-based tenant resolution:
 * - Visiting via reseller domain/subdomain -> renders ONLY that specific reseller's store.
 * - Visiting via main website -> renders ONLY the main store (zero reseller listings/cards).
 */

import React, { useState, useEffect } from 'react';
import { Navbar, ActiveTab } from './components/Navbar.tsx';
import { MainStore } from './components/MainStore.tsx';
import { ResellerStorefront } from './components/ResellerStorefront.tsx';
import { ResellerPortal } from './components/ResellerPortal.tsx';
import { AdminPortal } from './components/AdminPortal.tsx';
import { CustomerPortal } from './components/CustomerPortal.tsx';
import { CustomerAuthModal } from './components/CustomerAuthModal.tsx';
import { OrderTrackerModal } from './components/OrderTrackerModal.tsx';
import { ResellerApplicationModal } from './components/ResellerApplicationModal.tsx';
import { api } from './lib/api.ts';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('main_store');
  const [currentRole, setCurrentRole] = useState<'customer' | 'reseller' | 'admin'>('customer');
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [showTrackModal, setShowTrackModal] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [trackedOrderNum, setTrackedOrderNum] = useState('');

  // Hostname & Subdomain Resolution
  const [resellerDomain, setResellerDomain] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const urlParams = new URLSearchParams(window.location.search);
    const domainQuery = urlParams.get('domain') || urlParams.get('store');
    if (domainQuery) return domainQuery.trim().toLowerCase();

    const host = window.location.hostname;
    if (host && host.includes('.')) {
      const parts = host.split('.');
      if (parts.length > 2 && !['www', 'ais-dev', 'ais-pre', 'localhost'].includes(parts[0])) {
        return parts[0].toLowerCase();
      }
    }
    return null;
  });

  // Verify stored session on initial boot
  useEffect(() => {
    const checkSession = async () => {
      try {
        const token = api.getToken();
        if (token) {
          const res = await api.getMe();
          if (res?.user) {
            setCurrentUser(res.user);
            setCurrentRole(res.user.role);
          }
        }
      } catch (e) {
        console.log('No existing authenticated session found.');
      }
    };
    checkSession();
  }, []);

  const handleOpenTracker = (orderNumber: string) => {
    setTrackedOrderNum(orderNumber);
    setShowTrackModal(true);
  };

  const handleLogout = async () => {
    await api.logout();
    setCurrentUser(null);
    setCurrentRole('customer');
    setActiveTab('main_store');
  };

  const handleOpenAdminPortal = () => {
    if (currentUser?.role === 'admin') {
      setActiveTab('admin_portal');
    } else {
      setShowAuthModal(true);
    }
  };

  // If visitor navigated directly to a reseller's domain (or ?domain=... in testing)
  if (resellerDomain) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
        {/* Minimal Domain Navigation Header */}
        <header className="bg-white border-b border-slate-200 py-3 px-6 shadow-2xs">
          <div className="max-w-7xl mx-auto flex items-center justify-between text-xs">
            <span className="font-mono text-slate-500">
              Domain: <strong className="text-slate-900">{resellerDomain}.ssdigitalbd.shop</strong>
            </span>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowTrackModal(true)}
                className="font-medium text-slate-700 hover:text-slate-900"
              >
                Track Order
              </button>
              <button
                onClick={() => {
                  setResellerDomain(null);
                  window.history.pushState({}, '', '/');
                }}
                className="text-slate-400 hover:text-slate-600 font-medium"
              >
                Exit to Main Site
              </button>
            </div>
          </div>
        </header>

        {/* Reseller Storefront Exclusive View */}
        <main className="flex-1">
          <ResellerStorefront
            subdomain={resellerDomain}
            onTrackOrder={handleOpenTracker}
          />
        </main>

        <footer className="bg-white border-t border-slate-200 py-6 px-6 text-center text-xs text-slate-400">
          Powered by SSDigitalBD.shop Multi-Tenant Infrastructure · Isolated Domain Storefront
        </footer>

        <OrderTrackerModal
          isOpen={showTrackModal}
          initialOrderNumber={trackedOrderNum}
          onClose={() => {
            setShowTrackModal(false);
            setTrackedOrderNum('');
          }}
        />
      </div>
    );
  }

  // Otherwise, render Main Website (with zero reseller exposure)
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
      {/* Top Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenTrackModal={() => setShowTrackModal(true)}
        onOpenApplyModal={() => setShowApplyModal(true)}
        onOpenAuthModal={() => setShowAuthModal(true)}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Main View Portals */}
      <div className="flex-1">
        {activeTab === 'main_store' && (
          <MainStore onTrackOrder={handleOpenTracker} />
        )}

        {activeTab === 'customer_portal' && (
          <CustomerPortal
            currentUser={currentUser}
            onNavigateStore={() => setActiveTab('main_store')}
            onAuthRequired={() => setShowAuthModal(true)}
          />
        )}

        {activeTab === 'reseller_portal' && (
          <ResellerPortal
            onOpenStorefront={(sub) => {
              setResellerDomain(sub);
              window.history.pushState({}, '', `?domain=${sub}`);
            }}
          />
        )}

        {activeTab === 'admin_portal' && (
          <AdminPortal />
        )}
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-8 px-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="font-bold text-slate-900">SSDigitalBD.shop</span>
            <span>·</span>
            <span>Authorized Digital Subscriptions & Reseller Network</span>
            <span>·</span>
            <span className="font-mono text-emerald-600">ACID Ledger Verified</span>
          </div>

          <div className="flex items-center gap-6">
            <button onClick={() => setShowTrackModal(true)} className="hover:text-slate-900 transition-colors">
              Order Status
            </button>
            <button
              onClick={() => {
                if (currentUser) {
                  setActiveTab('customer_portal');
                } else {
                  setShowAuthModal(true);
                }
              }}
              className="hover:text-slate-900 transition-colors"
            >
              My Services
            </button>
            <button onClick={() => setShowApplyModal(true)} className="hover:text-slate-900 transition-colors">
              Reseller Program
            </button>
            <button
              onClick={handleOpenAdminPortal}
              className="hover:text-indigo-600 font-medium transition-colors"
            >
              Operations Console
            </button>
          </div>
        </div>
      </footer>

      {/* Universal Modals */}
      <OrderTrackerModal
        isOpen={showTrackModal}
        initialOrderNumber={trackedOrderNum}
        onClose={() => {
          setShowTrackModal(false);
          setTrackedOrderNum('');
        }}
      />

      <ResellerApplicationModal
        isOpen={showApplyModal}
        onClose={() => setShowApplyModal(false)}
      />

      <CustomerAuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthSuccess={(user) => {
          setCurrentUser(user);
          setCurrentRole(user.role);
          if (user.role === 'admin') {
            setActiveTab('admin_portal');
          } else if (user.role === 'reseller') {
            setActiveTab('reseller_portal');
          } else {
            setActiveTab('customer_portal');
          }
        }}
      />
    </div>
  );
}
