import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Kitchen Sales", template: "%s · Kitchen Sales" },
  description: "My kitchen and cabinet deals, from first message to commission paid.",
  appleWebApp: { capable: true, title: "Kitchen Sales", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f5f3ee",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" className="h-full antialiased">
        <body className="min-h-full">{children}</body>
      </html>
    </ClerkProvider>
  );
}
