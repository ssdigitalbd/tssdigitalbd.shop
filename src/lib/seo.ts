/**
 * Dynamic OpenGraph, Twitter, Canonical & JSON-LD Schema.org Injector
 * Adheres to applet-seo specifications for SSDigitalBD.shop & multi-tenant subdomains.
 */

export interface SeoConfig {
  title: string;
  description: string;
  url: string;
  type?: 'website' | 'article' | 'business.business';
  siteName?: string;
  image?: string;
  jsonLd?: Record<string, any>;
}

export function updatePageSeo(config: SeoConfig) {
  if (typeof document === 'undefined') return;

  // 1. Title
  document.title = config.title;

  // 2. Helper for meta tags
  const setMetaTag = (attribute: 'name' | 'property', attrValue: string, content: string) => {
    let element = document.querySelector(`meta[${attribute}="${attrValue}"]`) as HTMLMetaElement | null;
    if (!element) {
      element = document.createElement('meta');
      element.setAttribute(attribute, attrValue);
      document.head.appendChild(element);
    }
    element.setAttribute('content', content);
  };

  // 3. Description
  setMetaTag('name', 'description', config.description);

  // 4. OpenGraph Tags
  setMetaTag('property', 'og:title', config.title);
  setMetaTag('property', 'og:description', config.description);
  setMetaTag('property', 'og:url', config.url);
  setMetaTag('property', 'og:type', config.type || 'website');
  setMetaTag('property', 'og:site_name', config.siteName || 'SSDigitalBD.shop');
  setMetaTag('property', 'og:locale', 'en_US');
  if (config.image) {
    setMetaTag('property', 'og:image', config.image);
  }

  // 5. Twitter Card Tags
  setMetaTag('name', 'twitter:card', 'summary_large_image');
  setMetaTag('name', 'twitter:title', config.title);
  setMetaTag('name', 'twitter:description', config.description);
  if (config.image) {
    setMetaTag('name', 'twitter:image', config.image);
  }

  // 6. Canonical Link
  let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    document.head.appendChild(canonical);
  }
  canonical.setAttribute('href', config.url);

  // 7. Schema.org JSON-LD Structured Data
  const existingScript = document.getElementById('applet-seo-jsonld');
  if (existingScript) {
    existingScript.remove();
  }

  if (config.jsonLd) {
    const script = document.createElement('script');
    script.id = 'applet-seo-jsonld';
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(config.jsonLd);
    document.head.appendChild(script);
  }
}
