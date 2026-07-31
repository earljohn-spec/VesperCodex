import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui";
import { ServiceWorkerRegistrar } from "@/components/service-worker";

export const metadata: Metadata = {
  title: {
    default: "Vesper — your wellness companion",
    template: "%s · Vesper",
  },
  description:
    "An AI wellness companion that remembers. Context-aware support, biometric stress detection, voice journalling, and habits that bend to your life — not the other way round.",
  applicationName: "Vesper",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Vesper", statusBarStyle: "black-translucent" },
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#110f1e",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <ServiceWorkerRegistrar />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
