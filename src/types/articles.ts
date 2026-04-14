export interface Article {
  _id: string;
  _type: "article";
  title: string;
  slug: { current: string };
  description: string;
  content: any; // Portable Text
  author: {
    _id: string;
    _type: "author";
    name: string;
    image?: {
      asset: {
        _ref: string;
        _type: "reference";
      };
    };
  };
  category: {
    _id: string;
    _type: "category";
    title: string;
    slug: { current: string };
  };
  image?: {
    asset: {
      _ref: string;
      _type: "reference";
    };
    alt?: string;
  };
  isPremium: boolean;
  estimatedReadTime?: number;
  tags?: string[];
  publishedAt: string;
  seo?: {
    metaTitle?: string;
    metaDescription?: string;
    keywords?: string[];
    canonicalUrl?: string;
  };
}

export interface Guide {
  _id: string;
  _type: "guide";
  title: string;
  slug: { current: string };
  description: string;
  content: any; // Portable Text
  author: {
    _id: string;
    _type: "author";
    name: string;
    image?: {
      asset: {
        _ref: string;
        _type: "reference";
      };
    };
  };
  category: {
    _id: string;
    _type: "category";
    title: string;
    slug: { current: string };
  };
  image?: {
    asset: {
      _ref: string;
      _type: "reference";
    };
    alt?: string;
  };
  isPremium: boolean;
  difficulty: "beginner" | "intermediate" | "advanced";
  estimatedReadTime?: number;
  tags?: string[];
  resources?: {
    title: string;
    url: string;
    description?: string;
  }[];
  publishedAt: string;
  seo?: {
    metaTitle?: string;
    metaDescription?: string;
    keywords?: string[];
    canonicalUrl?: string;
  };
}

// Union type for both articles and guides
export type ContentItem = Article | Guide;

// Preview types for listing pages
export interface ArticlePreview {
  _id: string;
  _type: "article";
  title: string;
  slug: { current: string };
  description: string;
  author: {
    name: string;
  };
  category: {
    title: string;
    slug: { current: string };
  };
  image?: {
    asset: {
      _ref: string;
      _type: "reference";
    };
    alt?: string;
  };
  isPremium: boolean;
  estimatedReadTime?: number;
  tags?: string[];
  publishedAt: string;
}

export interface GuidePreview {
  _id: string;
  _type: "guide";
  title: string;
  slug: { current: string };
  description: string;
  author: {
    name: string;
  };
  category: {
    title: string;
    slug: { current: string };
  };
  image?: {
    asset: {
      _ref: string;
      _type: "reference";
    };
    alt?: string;
  };
  isPremium: boolean;
  difficulty: "beginner" | "intermediate" | "advanced";
  estimatedReadTime?: number;
  tags?: string[];
  publishedAt: string;
}

export type ContentPreview = ArticlePreview | GuidePreview;
