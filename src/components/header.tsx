'use client';

import { Soup, ShoppingBag, UserCog, BookOpen } from 'lucide-react';
import Cart from '@/components/cart';
import Link from 'next/link';
import { Button } from './ui/button';
import { usePathname } from 'next/navigation';

export default function Header() {
  const pathname = usePathname();

  // Sembunyikan header untuk halaman admin dan dashboard kurir khusus
  if (pathname.startsWith('/admin') || pathname.startsWith('/kurir')) {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center">
        <div className="mr-4 flex">
          <a className="mr-6 flex items-center space-x-2" href="/">
            <Soup className="h-6 w-6 text-primary" />
            <span className="font-bold sm:inline-block font-headline text-lg">
              TakjilKu
            </span>
          </a>
        </div>
        <div className="flex flex-1 items-center justify-end space-x-2">
          <Button variant="ghost" size="icon" asChild title="Tata Cara Pemesanan">
            <Link href="/tata-cara">
              <BookOpen className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />
              <span className="sr-only">Tata Cara Pemesanan</span>
            </Link>
          </Button>
          <Button variant="ghost" size="icon" asChild title="Admin Panel">
            <Link href="/admin">
              <UserCog className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />
              <span className="sr-only">Admin Panel</span>
            </Link>
          </Button>
          <Button variant="outline" size="icon" asChild title="Riwayat Pesanan">
            <Link href="/orders">
              <ShoppingBag className="h-5 w-5" />
              <span className="sr-only">Riwayat Pesanan</span>
            </Link>
          </Button>
          <Cart />
        </div>
      </div>
    </header>
  );
}
