import { ReactNode } from 'react';

export interface BlogPost {
  slug: string;
  title: string;
  category: string;
  date: string;
  readTime: string;
  component: () => Promise<{ default: React.ComponentType }>;
}

export const POSTS: Record<string, BlogPost> = {};
