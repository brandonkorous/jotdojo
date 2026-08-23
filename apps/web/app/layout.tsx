import type { Metadata, Viewport } from "next";
import { brand, pigment } from "@/lib/brand";
import "./globals.css";

export const metadata: Metadata = {
    title: brand.name,
    description: brand.line,
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, title: brand.name, statusBarStyle: "default" },
};

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    // The canvas is the app; pinch-zooming the chrome is never what was meant.
    maximumScale: 1,
    viewportFit: "cover",
    // Mint holds in both modes, the way `--color-primary` does in globals.css.
    // One value, not a light/dark pair: the chrome is the brand here, not an
    // extension of the page.
    themeColor: pigment.mint,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" data-theme="paper">
            <head>
                <link
                    rel="stylesheet"
                    href="https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&family=Caveat:wght@500;600&display=swap"
                />
            </head>
            <body className="bg-base-300 text-base-content font-sans antialiased">
                {children}
            </body>
        </html>
    );
}
