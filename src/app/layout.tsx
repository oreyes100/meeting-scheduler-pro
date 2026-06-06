import React from 'react';
import './globals.css';
import { LocaleProvider } from '@/lib/i18n';
import { LocaleLang } from '@/components/LocaleLang';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-surface-secondary text-text antialiased font-sans m-0 p-0 overflow-hidden">
        <LocaleProvider>
          <LocaleLang />
          <main className="h-screen w-screen overflow-hidden">{children}</main>
        </LocaleProvider>
      </body>
    </html>
  );
}
