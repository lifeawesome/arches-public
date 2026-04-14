import { PortableTextBlock } from "@portabletext/react";

export interface Post {
  _id: string;
  title: string;
  slug: {
    current: string;
  };
  publishedAt: string | null | undefined;
  mainImage?: {
    asset: {
      _id: string;
      url: string;
    };
    alt?: string;
  };
  author?: {
    name: string;
    image?: {
      asset: {
        _id: string;
        url: string;
      };
    };
    bio?: PortableTextBlock[];
  };
  categories?: Array<{
    title: string;
    slug: {
      current: string;
    };
  }>;
  excerpt?: string;
  body?: PortableTextBlock[];
  seo?: {
    metaTitle?: string;
    metaDescription?: string;
    keywords?: string[];
    ogImage?: {
      asset: {
        _id: string;
        url: string;
      };
      alt?: string;
    };
    canonicalUrl?: string;
    noIndex?: boolean;
  };
}

export interface Category {
  _id: string;
  title: string;
  slug: {
    current: string;
  };
  description?: string;
}

export interface Author {
  _id: string;
  name: string;
  slug: {
    current: string;
  };
  image?: {
    asset: {
      _id: string;
      url: string;
    };
  };
  bio?: PortableTextBlock[];
}

export interface Comment {
  _id: string;
  content: string;
  createdAt: string;
  author: {
    name: string;
    email: string;
    avatar?: string;
    userId: string;
  };
  parentComment?: {
    _ref: string;
  };
  replies?: Comment[];
}
