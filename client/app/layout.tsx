import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/auth-context";
import { BRAND_NAME } from "@/components/brand";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: {
    default: `${BRAND_NAME} — signal-based outreach`,
    template: `%s · ${BRAND_NAME}`,
  },
  description:
    "Signarion turns raw buying signals into prioritised, context-aware outreach — so every conversation starts at peak intent.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={cn("h-full antialiased", geistMono.variable, "font-sans", inter.variable)}>
      <body className="flex min-h-full flex-col font-sans">
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
