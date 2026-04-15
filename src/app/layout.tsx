import type { Metadata } from 'next';
import { Inter, Crimson_Pro } from 'next/font/google';
import { Toaster } from 'sonner';
import { QueryProvider } from '@/components/layouts/query-provider';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const crimson = Crimson_Pro({ subsets: ['latin'], variable: '--font-crimson', display: 'swap' });

export const metadata: Metadata = {
  title: {
    default: 'Senate of the Philippines HRIS',
    template: '%s — Senate HRIS',
  },
  description:
    'Enterprise HR, payroll, and compliance platform for the Senate of the Philippines.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${crimson.variable}`}>
      <body>
        <QueryProvider>{children}</QueryProvider>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
