"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <SessionProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <ToastProvider>
              {children}
            </ToastProvider>
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
