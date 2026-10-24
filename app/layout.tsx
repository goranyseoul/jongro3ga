import type { Metadata } from "next";
import type { ReactNode } from "react";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

// Canonical public URL for absolute share-image links (docs/DEPLOY.md). Override per environment.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://pibook-app.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "PibooK",
  description: "From the first question to your next visit, one agent with you",
  applicationName: "PibooK",
  openGraph: { siteName: "PibooK", type: "website" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
