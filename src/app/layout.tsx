import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui";

export const metadata: Metadata = {
  title: {
    default: "Vesper — your wellness companion",
    template: "%s · Vesper",
  },
  description:
    "An AI wellness companion that remembers. Context-aware support, biometric stress detection, voice journalling, and habits that bend to your life — not the other way round.",
  applicationName: "Vesper",
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
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
