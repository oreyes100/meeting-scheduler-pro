import React from 'react';
import './globals.css';
import { LocaleProvider } from '@/lib/i18n';
import { LocaleLang } from '@/components/LocaleLang';
import { ThemeProvider, themeInitScript } from '@/lib/theme';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen bg-surface-secondary text-text antialiased font-sans m-0 p-0 overflow-hidden">
        <ThemeProvider>
          <LocaleProvider>
            <LocaleLang />
            <main className="h-screen w-screen overflow-hidden">{children}</main>
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
