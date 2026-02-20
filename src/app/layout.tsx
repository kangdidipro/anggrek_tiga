
import type { Metadata } from 'next';
import './globals.css';
import { cn } from '@/lib/utils';
import { Toaster } from '@/components/ui/toaster';
import { CartProvider } from '@/context/cart-provider';
import Header from '@/components/header';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { AdminProvider } from '@/context/admin-provider';

export const metadata: Metadata = {
  title: 'TakjilKu - Pesan Takjil Ramadhan UMKM RW06',
  description: 'Aplikasi pemesanan takjil Ramadhan online H-1 dengan fasilitas pesan antar ke rumah. Dukung UMKM warga Anggrek 3!',
  metadataBase: new URL('https://takjilku.com'), // Ganti dengan domain asli saat sudah dipublikasi
  openGraph: {
    title: 'TakjilKu - Pesan Takjil Ramadhan UMKM RW06',
    description: 'Pesan takjil favoritmu secara online. Antar langsung ke rumah oleh Karang Taruna Anggrek 3.',
    url: '/',
    siteName: 'TakjilKu',
    images: [
      {
        url: 'https://picsum.photos/seed/takjilku-og/1200/630',
        width: 1200,
        height: 630,
        alt: 'Pratinjau TakjilKu Ramadhan',
      },
    ],
    locale: 'id_ID',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TakjilKu - Pesan Takjil Ramadhan UMKM RW06',
    description: 'Pesan takjil favoritmu secara online. Antar langsung ke rumah.',
    images: ['https://picsum.photos/seed/takjilku-og/1200/630'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=PT+Sans:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet" />
      </head>
      <body className={cn('min-h-screen bg-background font-body antialiased')}>
        <FirebaseClientProvider>
          <AdminProvider>
            <CartProvider>
              <div className="relative flex min-h-screen flex-col">
                <Header />
                <main className="flex-1">{children}</main>
              </div>
              <Toaster />
            </CartProvider>
          </AdminProvider>
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
