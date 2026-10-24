import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pibu",
  description: "Agents that talk to Korean clinics on your behalf",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
