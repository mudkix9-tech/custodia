import type { Metadata } from "next";
import "./globals.css";
import Provider from "./Provider";

export const metadata: Metadata = {
  title: "Privaro | GDPR Compliance OS for Agencies",
  description: "A single platform that replaces the need for a dedicated DPO, expensive legal consultants, and spreadsheets.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-full font-sans" suppressHydrationWarning>
        <Provider>
          {children}
        </Provider>
      </body>
    </html>
  );
}
