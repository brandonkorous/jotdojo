import type { Metadata, Viewport } from "next";
import { brand, pigment } from "@/lib/brand";
import "./globals.css";
import { THEME_BOOT } from "@/lib/theme";

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

/**
 * No `data-theme` from the server: `paper-night` is scoped
 * `:root:not([data-theme])`, so its ABSENCE is what lets the room decide.
 * `THEME_BOOT` puts one back before the first paint if somebody chose.
 * Issues 002 and 043, ADR-116.
 *
 * `suppressHydrationWarning` covers exactly that one attribute, and is React's
 * own answer for it -- the boot script writes `data-theme` before hydration, so
 * React finds an attribute the server did not send. Nothing else here is
 * dynamic.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                {/* Before the stylesheet, so a chosen theme never flashes the
                    other one. It is inline for the same reason. */}
                <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
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
