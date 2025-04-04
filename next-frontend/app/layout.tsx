import type { Metadata, Viewport } from "next";
import "./globals.css";
import AppInsightsProvider from './components/AppInsightsProvider';
import Footer from "./components/Footer";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  themeColor: "#1e1b4b",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "AI Video Subtitler",
  description:
    "Add professional subtitles to your videos using AI-powered transcription. Easy to use, accurate, and customizable.",
  icons: {
    icon: [
      {
        url: "/favicon.ico",
        sizes: "any",
      },
      {
        url: "/favicon-32x32.png",
        type: "image/png",
        sizes: "32x32",
      },
    ],
    apple: {
      url: "/apple-touch-icon.png",
      sizes: "180x180",
    },
  },
  manifest: "/site.webmanifest",
  robots: "index, follow",
  openGraph: {
    type: "website",
    title: "AI Video Subtitler - Add Professional Subtitles with AI",
    description:
      "Add professional subtitles to your videos using AI-powered transcription. Easy to use, accurate, and customizable.",
    siteName: "AI Video Subtitler",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <html lang="en">
        <body className={inter.className}>
          <AppInsightsProvider>
            <main className="flex-grow bg-gradient-to-b from-[#0B1120] to-[#0B1120]/90">
              {children}
            </main>
            <Footer />
          </AppInsightsProvider>
        </body>
      </html>
    </>
  );
}
