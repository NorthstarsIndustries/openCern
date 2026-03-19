import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./components/design-tokens.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "OpenCERN — Particle Physics Platform",
  description: "Open-source particle physics analysis platform for CERN Open Data",
};

import ConvexClientProvider from "./ConvexClientProvider";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <ConvexClientProvider>
          {children}
        </ConvexClientProvider>
      </body>
    </html>
  );
}
