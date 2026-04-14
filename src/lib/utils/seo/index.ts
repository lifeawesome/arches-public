import { client } from "@/sanity/lib/client";
import type { SeoSettings, PageSeo, MetadataResult } from "@/types/seo";
import type { Metadata } from "next";

// Cache for global SEO settings (to avoid repeated queries)
let globalSeoCache: SeoSettings | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 60 * 1000; // 1 minute cache

/**
 * Fetch global SEO settings from Sanity
 */
export async function getGlobalSeoSettings(): Promise<SeoSettings | null> {
  const now = Date.now();
  
  // Return cached data if still valid
  if (globalSeoCache && cacheTimestamp && now - cacheTimestamp < CACHE_DURATION) {
    return globalSeoCache;
  }

  try {
    const settings = await client.fetch<SeoSettings>(
      `*[_type == "seoSettings" && _id == "seoSettings"][0]{
        _id,
        _type,
        defaultMetaTitle,
        defaultMetaDescription,
        defaultKeywords,
        siteName,
        siteUrl,
        tagline,
        defaultOgImage{
          asset->{
            _id,
            url
          },
          alt
        },
        twitterHandle,
        twitterCardType,
        facebookAppId,
        googleAnalyticsId,
        googleTagManagerId,
        facebookPixelId,
        customTrackingScripts,
        googleSiteVerification,
        bingSiteVerification,
        pinterestSiteVerification,
        robotsConfig,
        redirects,
        sitemapEnabled,
        excludeFromSitemap
      }`
    );

    // Update cache
    globalSeoCache = settings;
    cacheTimestamp = now;

    return settings;
  } catch (error) {
    console.error("Error fetching global SEO settings:", error);
    return null;
  }
}

/**
 * Fetch page-specific SEO settings from Sanity
 */
export async function getPageSeoSettings(pageId: string): Promise<PageSeo | null> {
  try {
    const page = await client.fetch<PageSeo>(
      `*[_type == "page" && pageId == $pageId][0]{
        _id,
        _type,
        pageId,
        title,
        path,
        metaTitle,
        metaDescription,
        keywords,
        ogTitle,
        ogDescription,
        ogImage{
          asset->{
            _id,
            url
          },
          alt
        },
        canonicalUrl,
        noIndex,
        noFollow,
        includeInSitemap,
        sitemapPriority,
        changeFrequency,
        structuredDataType,
        customStructuredData
      }`,
      { pageId }
    );

    return page;
  } catch (error) {
    console.error(`Error fetching page SEO settings for ${pageId}:`, error);
    return null;
  }
}

/**
 * Generate Next.js Metadata object by merging global and page-specific settings
 */
export async function generateMetadata(
  pageId?: string,
  fallbackTitle?: string,
  fallbackDescription?: string
): Promise<Metadata> {
  const globalSettings = await getGlobalSeoSettings();
  const pageSettings = pageId ? await getPageSeoSettings(pageId) : null;

  // Build title
  const title =
    pageSettings?.metaTitle ||
    fallbackTitle ||
    globalSettings?.defaultMetaTitle ||
    "Arches Network";

  // Build description
  const description =
    pageSettings?.metaDescription ||
    fallbackDescription ||
    globalSettings?.defaultMetaDescription ||
    "Working together to create successful businesses";

  // Build keywords
  const keywords = pageSettings?.keywords?.length
    ? pageSettings.keywords.join(", ")
    : globalSettings?.defaultKeywords?.join(", ");

  // Build OpenGraph title and description
  const ogTitle =
    pageSettings?.ogTitle ||
    pageSettings?.metaTitle ||
    fallbackTitle ||
    globalSettings?.defaultMetaTitle ||
    title;

  const ogDescription =
    pageSettings?.ogDescription ||
    pageSettings?.metaDescription ||
    fallbackDescription ||
    globalSettings?.defaultMetaDescription ||
    description;

  // Build OpenGraph image
  const ogImage =
    pageSettings?.ogImage?.asset?.url ||
    globalSettings?.defaultOgImage?.asset?.url;

  const ogImageAlt =
    pageSettings?.ogImage?.alt ||
    globalSettings?.defaultOgImage?.alt ||
    title;

  // Build metadata object
  const metadata: Metadata = {
    title,
    description,
  };

  // Add keywords if available
  if (keywords) {
    metadata.keywords = keywords;
  }

  // Add OpenGraph
  if (globalSettings?.siteName || ogImage) {
    metadata.openGraph = {
      title: ogTitle,
      description: ogDescription,
      siteName: globalSettings?.siteName || "Arches Network",
      type: "website",
    };

    if (ogImage) {
      metadata.openGraph.images = [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: ogImageAlt,
        },
      ];
    }

    if (globalSettings?.siteUrl && pageSettings?.path) {
      metadata.openGraph.url = `${globalSettings.siteUrl}${pageSettings.path}`;
    }
  }

  // Add Twitter Card
  if (globalSettings?.twitterHandle || ogImage) {
    metadata.twitter = {
      card: globalSettings?.twitterCardType || "summary_large_image",
      title: ogTitle,
      description: ogDescription,
    };

    if (globalSettings?.twitterHandle && metadata.twitter) {
      metadata.twitter.site = `@${globalSettings.twitterHandle}`;
      metadata.twitter.creator = `@${globalSettings.twitterHandle}`;
    }

    if (ogImage && metadata.twitter) {
      metadata.twitter.images = [ogImage];
    }
  }

  // Add robots directives
  const noIndex =
    pageSettings?.noIndex || globalSettings?.robotsConfig?.noindex || false;
  const noFollow =
    pageSettings?.noFollow || globalSettings?.robotsConfig?.nofollow || false;

  if (noIndex || noFollow) {
    metadata.robots = {
      index: !noIndex,
      follow: !noFollow,
    };
  }

  // Add canonical URL
  if (pageSettings?.canonicalUrl) {
    metadata.alternates = {
      canonical: pageSettings.canonicalUrl,
    };
  } else if (globalSettings?.siteUrl && pageSettings?.path) {
    metadata.alternates = {
      canonical: `${globalSettings.siteUrl}${pageSettings.path}`,
    };
  }

  // Add verification codes
  if (
    globalSettings?.googleSiteVerification ||
    globalSettings?.bingSiteVerification
  ) {
    metadata.verification = {};

    if (globalSettings.googleSiteVerification) {
      metadata.verification.google = globalSettings.googleSiteVerification;
    }

    if (globalSettings.bingSiteVerification) {
      metadata.verification.other = {
        "msvalidate.01": [globalSettings.bingSiteVerification],
      };
    }
  }

  return metadata;
}

/**
 * Get structured data for a page
 */
export function getStructuredData(
  type: string,
  data: Record<string, any>
): object {
  const baseData = {
    "@context": "https://schema.org",
    "@type": type,
  };

  return {
    ...baseData,
    ...data,
  };
}

/**
 * Create Organization structured data
 */
export async function getOrganizationStructuredData() {
  const settings = await getGlobalSeoSettings();
  
  if (!settings) return null;

  return getStructuredData("Organization", {
    name: settings.siteName,
    url: settings.siteUrl,
    logo: settings.defaultOgImage?.asset?.url,
    sameAs: settings.twitterHandle
      ? [`https://twitter.com/${settings.twitterHandle}`]
      : [],
  });
}

/**
 * Create WebSite structured data with search action
 */
export async function getWebSiteStructuredData() {
  const settings = await getGlobalSeoSettings();
  
  if (!settings) return null;

  return getStructuredData("WebSite", {
    name: settings.siteName,
    url: settings.siteUrl,
    description: settings.defaultMetaDescription,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${settings.siteUrl}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  });
}

/**
 * Clear the global SEO settings cache (useful after updates)
 */
export function clearSeoCache() {
  globalSeoCache = null;
  cacheTimestamp = 0;
}

/**
 * Get all redirects from SEO settings
 */
export async function getRedirects() {
  const settings = await getGlobalSeoSettings();
  return settings?.redirects?.filter((r) => r.enabled !== false) || [];
}

/**
 * Apply redirects to a given URL path
 */
export async function applyRedirects(path: string) {
  const redirects = await getRedirects();
  
  for (const redirect of redirects) {
    // Simple path matching (can be enhanced with regex/wildcards)
    if (redirect.from === path) {
      return {
        destination: redirect.to,
        statusCode: redirect.statusCode,
        permanent: redirect.isPermanent,
      };
    }
  }
  
  return null;
}

