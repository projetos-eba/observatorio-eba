import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Radar de performance · EBA Growth",
  description: "Observatório de marketing de performance e conversão da EBA Aceleradora Digital.",
  icons: { icon: "/favicon.svg" }
};

export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  return <html lang="pt-BR"><head>
    <link rel="preload" href="/manrope.ttf" as="font" type="font/ttf" crossOrigin="anonymous" />
    <link rel="preload" href="/radar.webp" as="image" />
    <link rel="stylesheet" href="/radar.css" />
    <link rel="stylesheet" href="/dialogs.css" />
    <link rel="stylesheet" href="/eba-theme.css" />
  </head><body>{children}</body></html>;
}
