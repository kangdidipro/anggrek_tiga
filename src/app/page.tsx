import { products } from '@/lib/products';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Recommendations from '@/components/recommendations';
import ProductList from '@/components/product-list';

export default function Home() {
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
          <CardContent className="text-center text-muted-foreground space-y-2">
            <p>
              Jamaah muslim dan warga Anggrek-3 di lingkungan RW06 dan sekitarnya yang kami hormati.
            </p>
            <p>
              Kami dari pengurus dan tim UMKM lingkungan RW06 dan sekitarnya, selama bulan Ramadhan ini akan menyediakan pemesanan takjil lewat online dengan fasilitas pesan antar (delivery) ke rumah pemesan.
              Adapun pengantaran dikenakan ongkir sebesar Rp. 2.500,- per satu kali antar/paket pesanan yang uangnya sepenuhnya untuk sipengantar dari anggota sekuriti.
            </p>
            <p className="font-bold">Demikian kami sampaikan semoga berguna.</p>
          </CardContent>
        </Card>
      </section>

      <Recommendations />

      <section id="menu" className="container">
        <div className="flex flex-col items-center gap-4 mb-8">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl font-headline">Menu Takjil</h2>
            <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed text-center">
              Pilih dari beragam hidangan lezat kami, mulai dari makanan utama hingga kue-kue manis.
            </p>
        </div>

        <ProductList products={products} />

      </section>

      <footer className="bg-muted py-6 mt-12">
        <div className="container text-center text-muted-foreground text-sm">
          &copy; {new Date().getFullYear()} TakjilKu. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
