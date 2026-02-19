'use client';

import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import Recommendations from '@/components/recommendations';
import ProductList from '@/components/product-list';
import { Loader2, BookOpen } from 'lucide-react';
import type { Product, Vendor } from '@/lib/types';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function Home() {
  const firestore = useFirestore();

  const menuItemsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'menuItems');
  }, [firestore]);

  const vendorsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'vendors');
  }, [firestore]);

  const { data: products, isLoading: isProductsLoading } = useCollection<Product>(menuItemsQuery);
  const { data: vendors, isLoading: isVendorsLoading } = useCollection<Vendor>(vendorsQuery);

  const isLoading = isProductsLoading || isVendorsLoading;

  return (
    <div className="flex flex-col gap-12 md:gap-16">
      <section className="container pt-8 md:pt-12">
        <Card className="border-2 border-primary/50 shadow-lg">
          <CardHeader className="text-center">
            <h1 className="font-headline text-2xl md:text-3xl font-bold text-primary">
              Form Pemesanan Takjil Ramadhan, UMKM
            </h1>
            <p className="text-lg md:text-xl font-arabic">
              ٱلسَّلَامُ عَلَيْكُمْ وَرَحْمَةُ ٱللَّٰهِ وَبَرَكَاتُهُ
            </p>
          </CardHeader>
          <CardContent className="text-center text-muted-foreground space-y-4">
            <p className="font-semibold text-foreground">
              Kepada Yth. Bapak dan Ibu warga Anggrek 3 RW06 dan sekitarnya
            </p>
            <p>
              Kami dari pengelola/pengurus UMKM Anggrek 3 RW06 dan sekitarnya, selama bulan Ramadhan 1447 UMKM anggrek 3 akan menyediakan <span className="font-bold italic text-foreground">pemesanan takjil H-1 lewat Aplikasi online</span> dengan <span className="italic underline">fasilitas pesan antar (delivery) ke rumah pemesan.</span>
            </p>
            <p>
              Adapun pengantaran dikenakan <span className="font-bold text-foreground">ongkir sebesar Rp. 2.500,- per satu kali antar/paket pesanan</span> yang uangnya sepenuhnya diberikan untuk sipengantar yang merupakan anak-anak/ anggota karang taruna Anggrek 3.
            </p>
            <div className="space-y-3">
              <p className="font-bold text-foreground bg-primary/5 p-2 rounded-md">
                Jika dalam proses pemesanan melalui aplikasi terjadi <span className="italic">trouble</span> silahkan hubungi call center kami +0811.9989.6567
              </p>
              <Button asChild variant="outline" className="border-primary text-primary hover:bg-primary/10">
                <Link href="/tata-cara" className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  Lihat Tata Cara Pemesanan
                </Link>
              </Button>
            </div>
            <p className="italic">
              Kami <span className="font-bold uppercase text-primary">SIAP</span> Melayani Bapak & Ibu semua, terimakasih kami ucapkan, semoga berkah dan barokah.
            </p>
            <div className="pt-4 border-t border-primary/10">
              <p className="font-bold text-foreground">Hormat Kami</p>
              <p className="font-medium text-primary">Pengelola UMKM RW 06 - GDC A3</p>
              <p className="text-xs">Anggrek 3 Grand Depok City</p>
            </div>
          </CardContent>
        </Card>
      </section>

      {isLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : products && products.length > 0 ? (
        <>
          <Recommendations products={products} />
          <section id="menu" className="container">
            <div className="flex flex-col items-center gap-4 mb-8">
                <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl font-headline">Menu Takjil</h2>
                <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed text-center">
                  Pilih dari beragam hidangan lezat kami, mulai dari makanan utama hingga kue-kue manis.
                </p>
            </div>
            <ProductList products={products} vendors={vendors || []} />
          </section>
        </>
      ) : (
        <section className="container text-center py-12">
          <p className="text-muted-foreground">Belum ada menu yang tersedia saat ini.</p>
        </section>
      )}

      <footer className="bg-muted py-6 mt-12">
        <div className="container text-center text-muted-foreground text-sm">
          &copy; {new Date().getFullYear()} TakjilKu. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
