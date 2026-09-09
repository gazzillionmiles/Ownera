import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "@/src/shared/components/Providers";
import { APP_NAME, APP_DESCRIPTION } from "@/src/constants";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://example.com";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: `${APP_NAME} - ${APP_DESCRIPTION}`,
  description: "Ownera is a collective-buying platform for residential societies. Aggregate demand with neighbors to get better bulk prices on household services.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.ico",
    apple: "/icons/apple-touch-icon.png",
  },
  openGraph: {
    title: `${APP_NAME} - Buy together. Pay less.`,
    description: "Collective buying for residential communities. Turn many homes into one better deal.",
    url: appUrl,
    siteName: APP_NAME,
    type: "website",
  },
  alternates: {
    canonical: appUrl,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={jakarta.variable}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('ownera_theme');if(t==='light'||t==='dark'){document.documentElement.classList.add(t)}else{document.documentElement.classList.add('light');}}catch(e){document.documentElement.classList.add('light');}})();`,
          }}
        />
      </head>
      <body className="font-sans antialiased bg-slate-50/70 dark:bg-[#0b0f17] text-slate-900 dark:text-[#f8fafc] transition-colors duration-200">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
