import { IBM_Plex_Sans, IBM_Plex_Mono, Spectral } from 'next/font/google';

export const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  variable: '--font-plex-sans',
  weight: ['300', '400', '500', '600'],
  display: 'swap',
});

export const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-plex-mono',
  weight: ['400', '500'],
  display: 'swap',
});

export const spectral = Spectral({
  subsets: ['latin'],
  variable: '--font-spectral',
  weight: ['300', '400'],
  style: ['normal', 'italic'],
  display: 'swap',
});
