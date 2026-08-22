import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "jotdojo",
  description: "Where the thought lands.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "jotdojo", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // The canvas is the app; pinch-zooming the chrome is never what was meant.
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F8F4EC" },
    { media: "(prefers-color-scheme: dark)", color: "#0E0F12" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="washi">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Fraunces:opsz,wght@9..144,400;9..144,600&display=swap"
        />
      </head>
      <body className="bg-base-100 text-base-content font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
