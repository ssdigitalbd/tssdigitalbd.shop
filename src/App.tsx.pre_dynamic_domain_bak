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
import { AdminLoginView } from './components/AdminLoginView.tsx';
import { ResellerLoginView } from './components/ResellerLoginView.tsx';
import { CustomerLoginView } from './components/CustomerLoginView.tsx';
import { RoleAccessDenied } from './components/RoleAccessDenied.tsx';
import { api } from './lib/api.ts';

export type AppRoute = 'home' | 'admin' | 'reseller' | 'customer';

export function getRouteFromPathname(pathname: string): AppRoute {
  if (!pathname) return 'home';
  const clean = pathname.toLowerCase().replace(/\/+$/, '') || '/';
  if (clean === '/admin' || clean.startsWith('/admin/')) return 'admin';
  if (clean === '/reseller' || clean.startsWith('/reseller/')) return 'reseller';
  if (clean === '/customer' || clean.startsWith('/customer/')) return 'customer';
  return 'home';
}

export function resolveResellerSubdomain(host: string, search: string = ''): string | null {
  if (!host) return null;

  // 1. Explicit query parameter support for testing (?domain=rahim or ?store=rahim)
  const urlParams = new URLSearchParams(search);
  const domainQuery = urlParams.get('domain') || urlParams.get('store');
  if (domainQuery) return domainQuery.trim().toLowerCase();

  const normalizedHost = host.toLowerCase().trim();

  // 2. Ignore local, cloud preview, and default hosting domains (always render Main Store)
  if (
    normalizedHost === 'localhost' ||
    normalizedHost === '127.0.0.1' ||
    normalizedHost.endsWith('.run.app') ||
    normalizedHost.endsWith('.onrender.com') ||
    normalizedHost.startsWith('ais-dev-') ||
    normalizedHost.startsWith('ais-pre-') ||
    normalizedHost.startsWith('tssdigitalbd-shop')
  ) {
    return null;
  }

  // 3. For the official domain (ssdigitalbd.shop):
  // ssdigitalbd.shop and www.ssdigitalbd.shop render the Main Store
  if (normalizedHost === 'ssdigitalbd.shop' || normalizedHost === 'www.ssdigitalbd.shop') {
    return null;
  }

  // 4. Genuine reseller subdomains (e.g., rahim.ssdigitalbd.shop)
  if (normalizedHost.endsWith('ssdigitalbd.shop')) {
    const parts = normalizedHost.split('.');
    if (parts.length === 3 && parts[0] !== 'www') {
      const reserved = ['www', 'mail', 'cpanel', 'webmail', 'api', 'admin'];
      if (!reserved.includes(parts[0])) {
        return parts[0];
      }
    }
  }

  return null;
}

export default function App() {
  // Current route based on URL pathname
  const [currentRoute, setCurrentRoute] = useState<AppRoute>(() => {
    if (typeof window === 'undefined') return 'home';
    return getRouteFromPathname(window.location.pathname);
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    if (typeof window === 'undefined') return 'main_store';
    const initialRoute = getRouteFromPathname(window.location.pathname);
    if (initialRoute === 'admin') return 'admin_portal';
    if (initialRoute === 'reseller') return 'reseller_portal';
    if (initialRoute === 'customer') return 'customer_portal';
    return 'main_store';
  });

  const [currentRole, setCurrentRole] = useState<'customer' | 'reseller' | 'admin'>('customer');
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [showTrackModal, setShowTrackModal] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [trackedOrderNum, setTrackedOrderNum] = useState('');

  // Strict Hostname & Subdomain Resolution
  const [resellerDomain, setResellerDomain] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return resolveResellerSubdomain(window.location.hostname, window.location.search);
  });

  // Navigate to route and sync browser URL pathname via HTML5 History API
  const navigateTo = (route: AppRoute, path?: string) => {
    const targetPath = path || (route === 'home' ? '/' : `/${route}`);
    if (typeof window !== 'undefined' && window.location.pathname !== targetPath) {
      window.history.pushState({ route }, '', targetPath);
    }
    setCurrentRoute(route);

    if (route === 'home') setActiveTab('main_store');
    else if (route === 'admin') setActiveTab('admin_portal');
    else if (route === 'reseller') setActiveTab('reseller_portal');
    else if (route === 'customer') setActiveTab('customer_portal');
  };

  // Listen to browser Back/Forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const route = getRouteFromPathname(window.location.pathname);
      setCurrentRoute(route);
      if (route === 'home') setActiveTab('main_store');
      else if (route === 'admin') setActiveTab('admin_portal');
      else if (route === 'reseller') setActiveTab('reseller_portal');
      else if (route === 'customer') setActiveTab('customer_portal');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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
  };

  const getDesignatedPortalInfo = (user: any) => {
    if (user?.role === 'admin') return { name: 'Admin Console', route: 'admin' as AppRoute };
    if (user?.role === 'reseller') return { name: 'Reseller Portal', route: 'reseller' as AppRoute };
    return { name: 'Customer Services', route: 'customer' as AppRoute };
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
                className="font-medium text-slate-700 hover:text-slate-900 cursor-pointer"
              >
                Track Order
              </button>
              <button
                onClick={() => {
                  setResellerDomain(null);
                  window.history.pushState({}, '', '/');
                  setCurrentRoute('home');
                  setActiveTab('main_store');
                }}
                className="text-slate-400 hover:text-slate-600 font-medium cursor-pointer"
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

  // Render Main Application with strict URL-based separation
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
      {/* Top Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onNavigate={(path) => {
          const route = getRouteFromPathname(path);
          navigateTo(route, path);
        }}
        onOpenTrackModal={() => setShowTrackModal(true)}
        onOpenApplyModal={() => setShowApplyModal(true)}
        onOpenAuthModal={() => navigateTo('customer')}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Main View Portals - Strictly isolated by currentRoute */}
      <div className="flex-1">
        {/* 1. Route: / (Public Storefront only) */}
        {currentRoute === 'home' && (
          <MainStore onTrackOrder={handleOpenTracker} />
        )}

        {/* 2. Route: /admin (Admin Login or Admin Portal only) */}
        {currentRoute === 'admin' && (
          !currentUser ? (
            <AdminLoginView
              onLoginSuccess={(user) => {
                setCurrentUser(user);
                setCurrentRole(user.role);
              }}
              onNavigateHome={() => navigateTo('home')}
            />
          ) : currentUser.role === 'admin' ? (
            <AdminPortal />
          ) : (
            <RoleAccessDenied
              requiredRoleName="Admin"
              currentUser={currentUser}
              onLogout={handleLogout}
              onNavigateHome={() => navigateTo('home')}
              onNavigateDesignatedPortal={() => navigateTo(getDesignatedPortalInfo(currentUser).route)}
              designatedPortalName={getDesignatedPortalInfo(currentUser).name}
            />
          )
        )}

        {/* 3. Route: /reseller (Reseller Login or Reseller Portal only) */}
        {currentRoute === 'reseller' && (
          !currentUser ? (
            <ResellerLoginView
              onLoginSuccess={(user) => {
                setCurrentUser(user);
                setCurrentRole(user.role);
              }}
              onNavigateHome={() => navigateTo('home')}
              onOpenApplyModal={() => setShowApplyModal(true)}
            />
          ) : currentUser.role === 'reseller' ? (
            <ResellerPortal
              onOpenStorefront={(sub) => {
                setResellerDomain(sub);
                window.history.pushState({}, '', `?domain=${sub}`);
              }}
            />
          ) : (
            <RoleAccessDenied
              requiredRoleName="Reseller"
              currentUser={currentUser}
              onLogout={handleLogout}
              onNavigateHome={() => navigateTo('home')}
              onNavigateDesignatedPortal={() => navigateTo(getDesignatedPortalInfo(currentUser).route)}
              designatedPortalName={getDesignatedPortalInfo(currentUser).name}
            />
          )
        )}

        {/* 4. Route: /customer (Customer Login/Register or Customer Portal only) */}
        {currentRoute === 'customer' && (
          !currentUser ? (
            <CustomerLoginView
              onLoginSuccess={(user) => {
                setCurrentUser(user);
                setCurrentRole(user.role);
              }}
              onNavigateHome={() => navigateTo('home')}
            />
          ) : currentUser.role === 'customer' ? (
            <CustomerPortal
              currentUser={currentUser}
              onNavigateStore={() => navigateTo('home')}
              onAuthRequired={() => {}}
            />
          ) : (
            <RoleAccessDenied
              requiredRoleName="Customer"
              currentUser={currentUser}
              onLogout={handleLogout}
              onNavigateHome={() => navigateTo('home')}
              onNavigateDesignatedPortal={() => navigateTo(getDesignatedPortalInfo(currentUser).route)}
              designatedPortalName={getDesignatedPortalInfo(currentUser).name}
            />
          )
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
            <button
              onClick={() => setShowTrackModal(true)}
              className="hover:text-slate-900 transition-colors cursor-pointer"
            >
              Order Status
            </button>
            <button
              onClick={() => navigateTo('customer')}
              className="hover:text-slate-900 transition-colors cursor-pointer"
            >
              My Services
            </button>
            <button
              onClick={() => navigateTo('reseller')}
              className="hover:text-slate-900 transition-colors cursor-pointer"
            >
              Reseller Program
            </button>
            <button
              onClick={() => navigateTo('admin')}
              className="hover:text-indigo-600 font-medium transition-colors cursor-pointer"
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
            navigateTo('admin');
          } else if (user.role === 'reseller') {
            navigateTo('reseller');
          } else {
            navigateTo('customer');
          }
        }}
      />
    </div>
  );
}
