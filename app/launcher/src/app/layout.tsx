import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "OpenCERN Launcher",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full bg-bg-base">
      <body className="h-full flex flex-col overflow-hidden">
        <PlatformDetector />
        {children}
      </body>
    </html>
  );
}

function PlatformDetector() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          (function() {
            var p = navigator.platform.toLowerCase();
            if (p.startsWith('win')) document.body.classList.add('platform-windows');
            else if (p.startsWith('linux') || p.includes('linux')) document.body.classList.add('platform-linux');
            else document.body.classList.add('platform-mac');
          })();
        `,
      }}
    />
  );
}
