// SEO Settings Types
export interface SeoSettings {
  _id: string;
  _type: "seoSettings";
  // Global Defaults
  defaultMetaTitle: string;
  defaultMetaDescription: string;
  defaultKeywords?: string[];
  siteName: string;
  siteUrl: string;
  tagline?: string;
  
  // Social Media
  defaultOgImage?: {
    asset: {
      _id: string;
      url: string;
    };
    alt?: string;
  };
  twitterHandle?: string;
  twitterCardType?: "summary" | "summary_large_image" | "app" | "player";
  facebookAppId?: string;
  
  // Analytics & Tracking
  googleAnalyticsId?: string;
  googleTagManagerId?: string;
  facebookPixelId?: string;
  customTrackingScripts?: string;
  
  // Search Engine Verification
  googleSiteVerification?: string;
  bingSiteVerification?: string;
  pinterestSiteVerification?: string;
  
  // Technical SEO
  robotsConfig?: {
    noindex?: boolean;
    nofollow?: boolean;
    noimageindex?: boolean;
    notranslate?: boolean;
    maxSnippet?: number;
    maxImagePreview?: "none" | "standard" | "large";
    maxVideoPreview?: number;
  };
  
  // Redirects
  redirects?: RedirectConfig[];
  
  // Sitemap
  sitemapEnabled?: boolean;
  excludeFromSitemap?: string[];
}

// Page-Level SEO
export interface PageSeo {
  _id: string;
  _type: "page";
  pageId: string;
  title: string;
  path: string;
  
  // SEO Fields
  metaTitle?: string;
  metaDescription?: string;
  keywords?: string[];
  
  // OpenGraph
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: {
    asset: {
      _id: string;
      url: string;
    };
    alt?: string;
  };
  
  // Technical
  canonicalUrl?: string;
  noIndex?: boolean;
  noFollow?: boolean;
  
  // Sitemap
  includeInSitemap?: boolean;
  sitemapPriority?: number;
  changeFrequency?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  
  // Structured Data
  structuredDataType?: StructuredDataType;
  customStructuredData?: string;
}

// Redirect Configuration
export interface RedirectConfig {
  _key: string;
  from: string;
  to: string;
  statusCode: 301 | 302 | 307 | 308;
  isPermanent: boolean;
  enabled?: boolean;
}

// Structured Data Types
export type StructuredDataType =
  | "WebPage"
  | "AboutPage"
  | "ContactPage"
  | "FAQPage"
  | "Organization"
  | "WebSite"
  | "BreadcrumbList"
  | "SearchAction"
  | null;

// Metadata Result
export interface MetadataResult {
  title: string;
  description: string;
  keywords?: string;
  openGraph?: {
    title: string;
    description: string;
    url?: string;
    siteName: string;
    images?: Array<{
      url: string;
      width?: number;
      height?: number;
      alt?: string;
    }>;
    locale?: string;
    type?: string;
  };
  twitter?: {
    card: string;
    site?: string;
    creator?: string;
    title: string;
    description: string;
    images?: string[];
  };
  robots?: {
    index?: boolean;
    follow?: boolean;
    googleBot?: {
      index?: boolean;
      follow?: boolean;
    };
  };
  alternates?: {
    canonical?: string;
  };
  verification?: {
    google?: string;
    yandex?: string;
    yahoo?: string;
  };
}

// Structured Data Schema
export interface StructuredData {
  "@context": string;
  "@type": string;
  [key: string]: any;
}

// SEO Health Check
export interface SeoHealthCheck {
  status: "healthy" | "warning" | "error";
  checks: {
    sitemapAccessible: boolean;
    robotsTxtAccessible: boolean;
    analyticsConfigured: boolean;
    globalSettingsComplete: boolean;
    pagesWithCustomSeo: number;
    totalPages: number;
    activeRedirects: number;
  };
  issues: string[];
  warnings: string[];
}

