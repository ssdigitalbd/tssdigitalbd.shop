/**
 * DigiMarket Master Application
 * Production Digital Marketplace, Reseller Stores, Wholesale Ledger & Admin Consoles.
 *
 * Implements strict domain-based tenant resolution:
 * - Visiting via reseller domain/subdomain -> renders ONLY that specific reseller's store.
 * - Visiting via main website -> renders ONLY the main store (zero reseller listings/cards).
 * - Dynamically injects OpenGraph, Twitter, Canonical & JSON-LD Schema.org SEO meta tags.
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
import { SellerLoginView } from './components/SellerLoginView.tsx';
import { RoleAccessDenied } from './components/RoleAccessDenied.tsx';
import { YouTubeMarketplace } from './components/YouTubeMarketplace.tsx';
import { updatePageSeo } from './lib/seo.ts';
import { api } from './lib/api.ts';

export type AppRoute = 'home' | 'admin' | 'reseller' | 'customer' | 'seller' | 'youtube';

export function getRouteFromPathname(pathname: string): AppRoute {
  if (!pathname) return 'home';
  const clean = pathname.toLowerCase().replace(/\/+$/, '') || '/';
  if (clean === '/admin' || clean.startsWith('/admin/')) return 'admin';
  if (clean === '/reseller' || clean.startsWith('/reseller/')) return 'reseller';
  if (clean === '/customer' || clean.startsWith('/customer/')) return 'customer';
  if (clean === '/seller' || clean.startsWith('/seller/')) return 'seller';
  if (clean === '/youtube' || clean.startsWith('/youtube/')) return 'youtube';
  return 'home';
}

export function resolveResellerSubdomain(host: string, search: string = '', pathname: string = ''): string | null {
  if (!host) return null;

  // Reserved subdomains and system routes that can never be reseller storefronts
  const reservedKeywords = [
    'www', 'mail', 'cpanel', 'webmail', 'api', 'admin',
    'reseller', 'customer', 'seller', 'youtube', 'app', 'dev', 'stage', 'test',
    'preview', 'portal', 'status', 'auth', 'account', 'login',
    'signup', 'dashboard', 'console', 'root', 'static', 'assets'
  ];

  // 1. Path-based storefront route: /store/:slug
  if (pathname) {
    const cleanPath = pathname.toLowerCase().replace(/\/+$/, '');
    if (cleanPath.startsWith('/store/')) {
      const parts = cleanPath.split('/');
      const slug = parts[2];
      if (slug && !reservedKeywords.includes(slug) && /^[a-z0-9-]+$/.test(slug)) {
        return slug;
      }
    }
  }

  // 2. Explicit query parameter support (?domain=... or ?store=...)
  // Protected against reserved keywords and invalid slugs
  const urlParams = new URLSearchParams(search);
  const domainQuery = (urlParams.get('domain') || urlParams.get('store') || '').trim().toLowerCase();
  if (domainQuery) {
    if (reservedKeywords.includes(domainQuery) || !/^[a-z0-9-]+$/.test(domainQuery)) {
      return null;
    }
    return domainQuery;
  }

  // 3. Normalize host (strip port and whitespace)
  const normalizedHost = host.split(':')[0].toLowerCase().trim();

  // 4. Ignore local, cloud preview, and default hosting domains (always render Main Store)
  if (
    normalizedHost === 'localhost' ||
    normalizedHost === '127.0.0.1' ||
    normalizedHost.endsWith('.run.app') ||
    normalizedHost.endsWith('.onrender.com') ||
    normalizedHost.endsWith('.render.com') ||
    normalizedHost.startsWith('ais-dev-') ||
    normalizedHost.startsWith('ais-pre-') ||
    /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(normalizedHost)
  ) {
    return null;
  }

  // 5. Dynamic apex vs subdomain resolution (zero hardcoding of specific domain names)
  const parts = normalizedHost.split('.');

  // If host has 2 or fewer labels (e.g. ssdigitalbd.shop, anydomain.com), it is an apex/root domain -> Main Store
  if (parts.length <= 2) {
    return null;
  }

  // Known multi-part ccTLDs where 3 parts still represent an apex domain (e.g. brand.com.bd)
  const twoPartTlds = [
    'com.bd', 'org.bd', 'net.bd', 'edu.bd', 'gov.bd',
    'co.uk', 'org.uk', 'com.au', 'net.au', 'co.nz',
    'co.in', 'net.in', 'org.in'
  ];
  const lastTwoLabels = parts.slice(-2).join('.');
  const isTwoPartTld = twoPartTlds.includes(lastTwoLabels);

  let candidateSubdomain: string | null = null;

  if (parts.length === 3) {
    if (isTwoPartTld) {
      // e.g. "brand.com.bd" is an apex domain, not a subdomain
      return null;
    }
    candidateSubdomain = parts[0];
  } else if (parts.length === 4 && isTwoPartTld) {
    // e.g. "rahim.brand.com.bd"
    candidateSubdomain = parts[0];
  }

  if (candidateSubdomain) {
    if (
      reservedKeywords.includes(candidateSubdomain) ||
      !/^[a-z0-9-]+$/.test(candidateSubdomain) ||
      (candidateSubdomain.length > 15 && /-[a-z0-9]{4,6}$/.test(candidateSubdomain)) ||
      candidateSubdomain.startsWith('preview-') ||
      candidateSubdomain.endsWith('-preview')
    ) {
      return null;
    }
    return candidateSubdomain;
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
    if (initialRoute === 'seller') return 'seller_portal';
    return 'main_store';
  });

  const [currentRole, setCurrentRole] = useState<'customer' | 'reseller' | 'admin'>('customer');
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [showTrackModal, setShowTrackModal] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [trackedOrderNum, setTrackedOrderNum] = useState('');

  // Strict Hostname & Subdomain Resolution (Supports subdomain, ?domain=, and /store/:slug)
  const [resellerDomain, setResellerDomain] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return resolveResellerSubdomain(window.location.hostname, window.location.search, window.location.pathname);
  });

  // Dynamic OpenGraph, Canonical, Twitter & Schema.org Structured Data Injection
  useEffect(() => {
    if (resellerDomain) {
      const storeUrl = typeof window !== 'undefined'
        ? window.location.href.split('?')[0]
        : `https://${resellerDomain}.ssdigitalbd.shop/`;

      updatePageSeo({
        title: `${resellerDomain.toUpperCase()} · Authorized Digital Storefront | SSDigitalBD Partner`,
        description: `Shop authentic digital software licenses, creative subscriptions, and developer tools directly from ${resellerDomain}. Instant delivery with verified bKash, Nagad, and Rocket checkout.`,
        url: storeUrl,
        type: 'business.business',
        siteName: `${resellerDomain} Storefront · SSDigitalBD.shop Partner`,
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'Store',
          name: `${resellerDomain} Digital Storefront`,
          url: storeUrl,
          description: `Authorized independent partner storefront powered by SSDigitalBD.shop infrastructure.`,
          currenciesAccepted: 'BDT',
          paymentAccepted: 'bKash, Nagad, Rocket, Bank Transfer',
          parentOrganization: {
            '@type': 'Organization',
            name: 'SSDigitalBD.shop',
            url: 'https://www.ssdigitalbd.shop',
          },
        },
      });
    } else if (currentRoute === 'home') {
      updatePageSeo({
        title: 'SSDigitalBD.shop - Digital Marketplace & Subscriptions Bangladesh',
        description: 'Bangladesh\'s premier digital marketplace for genuine subscriptions, creative software licenses, developer tools, and instant automated delivery.',
        url: 'https://www.ssdigitalbd.shop/',
        type: 'website',
        siteName: 'SSDigitalBD.shop',
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          name: 'SSDigitalBD.shop',
          url: 'https://www.ssdigitalbd.shop/',
          applicationCategory: 'BusinessApplication',
          operatingSystem: 'All',
          offers: {
            '@type': 'AggregateOffer',
            priceCurrency: 'BDT',
          },
        },
      });
    } else if (currentRoute === 'seller') {
      updatePageSeo({
        title: 'Seller Center & Creator Portal | SSDigitalBD.shop',
        description: 'Publish and sell software licenses, source codes, and digital templates with instant bKash, Nagad, and bank payouts on Bangladesh\'s premier marketplace.',
        url: 'https://www.ssdigitalbd.shop/seller',
        type: 'website',
        siteName: 'SSDigitalBD.shop',
      });
    } else if (currentRoute === 'admin') {
      updatePageSeo({
        title: 'Admin Console · Operations & Security | SSDigitalBD.shop',
        description: 'Administrative operations console, ACID ledger reconciliation, order approvals, and platform management.',
        url: 'https://www.ssdigitalbd.shop/admin',
        type: 'website',
        siteName: 'SSDigitalBD.shop',
      });
    } else if (currentRoute === 'reseller') {
      updatePageSeo({
        title: 'Reseller Partner Console | SSDigitalBD.shop',
        description: 'Manage digital storefronts, wholesale wallet ledger, promotional bonuses, and customer order fulfillment.',
        url: 'https://www.ssdigitalbd.shop/reseller',
        type: 'website',
        siteName: 'SSDigitalBD.shop',
      });
    } else if (currentRoute === 'customer') {
      updatePageSeo({
        title: 'Customer Account & Digital Licenses | SSDigitalBD.shop',
        description: 'Access your purchased subscriptions, license keys, automated delivery updates, and support ticket vault.',
        url: 'https://www.ssdigitalbd.shop/customer',
        type: 'website',
        siteName: 'SSDigitalBD.shop',
      });
    } else if (currentRoute === 'youtube') {
      updatePageSeo({
        title: 'Verified YouTube Channels Marketplace | 7-Day Protection | SSDigitalBD.shop',
        description: 'Buy and sell monetized YouTube channels with 7-Day Buyer Protection, zero copyright strikes guarantee, and secure AdSense handover in Bangladesh.',
        url: 'https://www.ssdigitalbd.shop/youtube',
        type: 'website',
        siteName: 'SSDigitalBD.shop',
      });
    }
  }, [currentRoute, resellerDomain]);

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
    else if (route === 'seller') setActiveTab('seller_portal');
  };

  // Listen to browser Back/Forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const detectedDomain = resolveResellerSubdomain(window.location.hostname, window.location.search, window.location.pathname);
      setResellerDomain(detectedDomain);

      const route = getRouteFromPathname(window.location.pathname);
      setCurrentRoute(route);
      if (route === 'home') setActiveTab('main_store');
      else if (route === 'admin') setActiveTab('admin_portal');
      else if (route === 'reseller') setActiveTab('reseller_portal');
      else if (route === 'customer') setActiveTab('customer_portal');
      else if (route === 'seller') setActiveTab('seller_portal');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Verify stored session on initial boot
  useEffect(() => {
    let isMounted = true;
    const checkSession = async () => {
      try {
        const token = api.getToken();
        if (token) {
          const res = await api.getMe();
          if (isMounted && res && res.user) {
            setCurrentUser(res.user);
            setCurrentRole(res.user.role);
          } else if (isMounted) {
            api.setToken(null);
          }
        }
      } catch (e) {
        if (isMounted) {
          console.log('No existing active authenticated session.');
          api.setToken(null);
        }
      } finally {
        if (isMounted) {
          setAuthLoading(false);
        }
      }
    };
    checkSession();
    return () => {
      isMounted = false;
    };
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
    if (!user || typeof user !== 'object') {
      return { name: 'Customer Services', route: 'customer' as AppRoute };
    }
    const role = (user.role || '').toLowerCase();
    if (role === 'admin' || role === 'super_admin') return { name: 'Admin Console', route: 'admin' as AppRoute };
    if (role === 'reseller') return { name: 'Reseller Portal', route: 'reseller' as AppRoute };
    if (role === 'seller') return { name: 'Seller Center', route: 'seller' as AppRoute };
    return { name: 'Customer Services', route: 'customer' as AppRoute };
  };

  // If visitor navigated directly to a reseller's domain (or ?domain=... or /store/:slug)
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
          authLoading ? (
            <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center">
              <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Verifying secure admin session...</p>
            </div>
          ) : !currentUser ? (
            <AdminLoginView
              onLoginSuccess={(user) => {
                if (!user) return;
                setCurrentUser(user);
                setCurrentRole(user.role);
              }}
              onNavigateHome={() => navigateTo('home')}
            />
          ) : ((currentUser.role || '').toLowerCase() === 'admin' || (currentUser.role || '').toLowerCase() === 'super_admin') ? (
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
          authLoading ? (
            <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center">
              <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Verifying reseller session...</p>
            </div>
          ) : !currentUser ? (
            <ResellerLoginView
              onLoginSuccess={(user) => {
                if (!user) return;
                setCurrentUser(user);
                setCurrentRole(user.role);
              }}
              onNavigateHome={() => navigateTo('home')}
              onOpenApplyModal={() => setShowApplyModal(true)}
            />
          ) : (currentUser.role || '').toLowerCase() === 'reseller' ? (
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
          authLoading ? (
            <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center">
              <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Verifying customer account...</p>
            </div>
          ) : !currentUser ? (
            <CustomerLoginView
              onLoginSuccess={(user) => {
                if (!user) return;
                setCurrentUser(user);
                setCurrentRole(user.role);
              }}
              onNavigateHome={() => navigateTo('home')}
            />
          ) : (currentUser.role || '').toLowerCase() === 'customer' ? (
            <CustomerPortal
              currentUser={currentUser}
              initialTab="orders"
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

        {/* 5. Route: /seller (Seller Login/Register or Seller Center Dashboard) */}
        {currentRoute === 'seller' && (
          authLoading ? (
            <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center">
              <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Verifying seller session...</p>
            </div>
          ) : !currentUser ? (
            <SellerLoginView
              onLoginSuccess={(user) => {
                if (!user) return;
                setCurrentUser(user);
                setCurrentRole(user.role);
              }}
              onNavigateHome={() => navigateTo('home')}
            />
          ) : (
            <CustomerPortal
              currentUser={currentUser}
              initialTab="seller"
              onNavigateStore={() => navigateTo('home')}
              onAuthRequired={() => {}}
            />
          )
        )}

        {/* 6. Route: /youtube (Verified YouTube Channel Marketplace with 7-Day Buyer Protection) */}
        {currentRoute === 'youtube' && (
          <YouTubeMarketplace
            currentUser={currentUser}
            onAuthRequired={() => navigateTo('customer')}
            onOpenSellerCenter={() => navigateTo('seller')}
          />
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
              onClick={() => navigateTo('seller')}
              className="hover:text-indigo-600 font-medium transition-colors cursor-pointer"
            >
              Seller Center
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
          if (!user) return;
          setCurrentUser(user);
          setCurrentRole(user.role);
          const r = (user.role || '').toLowerCase();
          if (r === 'admin' || r === 'super_admin') {
            navigateTo('admin');
          } else if (r === 'reseller') {
            navigateTo('reseller');
          } else {
            navigateTo('customer');
          }
        }}
      />
    </div>
  );
}
