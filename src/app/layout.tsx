import type { Metadata } from "next";
import { Inter } from "next/font/google";
import BotBackdrop from "@/components/BotBackdrop";
import "./globals.css";

// One standard sans for the whole app, headings included.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CollabOS",
  description: "AI-powered CRM and unified dashboard for social media influencers",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen antialiased">
        <BotBackdrop />
        {/* Content sits above the fixed backdrop */}
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
