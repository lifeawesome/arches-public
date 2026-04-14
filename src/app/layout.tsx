import type { Metadata } from "next";
import { Montserrat_Alternates } from "next/font/google";
import "./globals.css";
import { ImpersonationBanner } from "@/components/admin/ImpersonationBanner";
import { MonitoringInit } from "@/components/monitoring/MonitoringInit";

const montserratBold = Montserrat_Alternates({
  variable: "--font-montserratBold",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: {
    template: "%s | Arches Network",
    default: "Arches Network — Where Experts Are Made",
  },
  description: "Arches Network helps developing experts build confidence, clarity, and credibility — so when the world finds you, you're ready.",
  icons: {
    icon: [
      { url: "/favicon.ico", type: "image/x-icon" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    other: [
      {
        rel: "icon",
        url: "/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        rel: "icon",
        url: "/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${montserratBold.variable} antialiased`}
      >
        <ImpersonationBanner />
        <MonitoringInit />
        {children}
      </body>
    </html>
  );
}
