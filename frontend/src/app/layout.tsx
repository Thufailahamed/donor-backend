import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { ToastProvider } from "@/components/Toast";
import DotGrid from "@/components/DotGrid";

export const metadata: Metadata = {
  title: "IDES | Donor Summit on MSME Transformation",
  description: "Interactive Digital Engagement System — Real-time interaction, knowledge capture, and analytics for the Donor Summit on MSME Transformation.",
  keywords: ["Donor Summit", "MSME", "Engagement", "Interactive", "Real-time", "Q&A"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <DotGrid />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <AuthProvider>
            <ToastProvider>
              {children}
            </ToastProvider>
          </AuthProvider>
        </div>
      </body>
    </html>
  );
}
