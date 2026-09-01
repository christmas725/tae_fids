import type { Metadata, Viewport } from "next";
import PwaRegister from "@/components/PwaRegister";
import "./globals.css";

export const metadata: Metadata = {
  title: "TAE FIDS v0.1",
  description: "대구국제공항 실시간 출발·도착 FIDS",
  applicationName: "TAE FIDS",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "TAE FIDS",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [{ url: "/icons/tae-fids.svg", sizes: "any", type: "image/svg+xml" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#155db0",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
