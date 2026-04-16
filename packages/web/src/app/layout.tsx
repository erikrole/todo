import type { Metadata, Viewport } from "next";
import { Barlow, JetBrains_Mono } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Todo",
  description: "Personal task manager",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${barlow.variable} ${jetbrainsMono.variable} h-full`} suppressHydrationWarning>
      <body className="h-full bg-background text-foreground antialiased">
        {/* Sync accent before first paint to prevent flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var a=localStorage.getItem('todo-accent');if(a)document.documentElement.setAttribute('data-accent',a);}catch(e){}})()`,
          }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
