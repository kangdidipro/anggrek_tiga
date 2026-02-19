'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ClipboardCheck, Users, PackageOpen, ListChecks, Truck, Banknote, ArrowRight, Info, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

const steps = [
  {
    title: 'Pemesanan & Struk',
    description: 'Pelanggan memilih menu dan mengisi form pesanan. Sistem (Panitia) akan menerbitkan struk digital otomatis sebagai bukti pesanan.',
    icon: ClipboardCheck,
    color: 'bg-orange-500',
  },
  {
    title: 'Koordinasi Mitra (H-1)',
    description: 'Panitia akan merangkum daftar pesanan dan mengirimkannya ke masing-masing Mitra/Vendor pada H-1 (sebelum jam 16:00 WIB).',
    icon: Users,
    color: 'bg-blue-500',
  },
  {
    title: 'Pengumpulan di Pos 1',
    description: 'Mitra menyiapkan makanan dan mengumpulkan seluruh pesanan di Pos 1 (Pusat Distribusi) pada hari H (sebelum jam 13:00 WIB).',
    icon: PackageOpen,
    color: 'bg-purple-500',
  },
  {
    title: 'Pengecekan & Packing',
    description: 'Tim Panitia melakukan proses cek list akhir dan pengemasan (packing) per alamat rumah pemesan untuk memastikan tidak ada item yang tertukar.',
    icon: ListChecks,
    color: 'bg-yellow-500',
  },
  {
    title: 'Waktu Pengantaran',
    description: 'Pesanan diantar ke rumah warga mulai pukul 14:00 s/d 17:30 WIB oleh adik-adik Karang Taruna Anggrek 3.',
    icon: Truck,
    color: 'bg-green-600',
  },
  {
    title: 'Konfirmasi Pembayaran',
    description: 'Penyelesaian pembayaran dilakukan sesuai metode yang dipilih (QRIS/COD). Status pesanan akan diperbarui menjadi SELESAI di aplikasi.',
    icon: Banknote,
    color: 'bg-emerald-500',
  },
];

export default function TataCaraPage() {
  return (
    <div className="container py-8 md:py-12 max-w-4xl mx-auto px-4">
      <div className="mb-10 text-center">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight font-headline text-primary mb-4">Tata Cara Pemesanan</h1>
        <p className="text-muted-foreground text-lg">Panduan langkah demi langkah proses operasional TakjilKu untuk Warga & Mitra.</p>
      </div>

      <div className="space-y-8 relative">
        {/* Progress Line (Desktop) */}
        <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-muted hidden md:block" />

        {steps.map((step, index) => (
          <div key={index} className="relative flex flex-col md:flex-row gap-6 items-start">
            {/* Step Number/Icon */}
            <div className={`z-10 flex h-16 w-16 shrink-0 items-center justify-center rounded-full ${step.color} text-white shadow-lg`}>
              <step.icon className="h-8 w-8" />
            </div>

            <Card className="flex-1 shadow-sm border-primary/10">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Langkah {index + 1}</span>
                </div>
                <CardTitle className="text-xl text-primary font-headline">{step.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      <div className="mt-16 space-y-8">
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Info className="h-5 w-5" />
              Sistem Baru: Status Per Mitra
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground italic">
              "Kini setiap pesanan Anda dikelola secara independen di tingkat Mitra. Jika dalam 1 pesanan terdapat 3 UMKM yang berbeda, Anda dapat melihat progres pengerjaan masing-masing UMKM secara terpisah."
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-4 bg-white rounded-lg border shadow-sm">
                <h4 className="font-bold text-xs uppercase mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-orange-500" />
                  Alur Tipe A (QRIS)
                </h4>
                <ul className="text-xs space-y-2 text-muted-foreground">
                  <li className="flex items-center gap-2"><ArrowRight className="h-3 w-3" /> Dipesan (Oleh Customer)</li>
                  <li className="flex items-center gap-2 font-bold text-primary"><ArrowRight className="h-3 w-3" /> Dibayar (Konfirmasi Payment)</li>
                  <li className="flex items-center gap-2"><ArrowRight className="h-3 w-3" /> Diproses (Pengerjaan Mitra)</li>
                  <li className="flex items-center gap-2"><ArrowRight className="h-3 w-3" /> Dikumpulkan (Siap di Pos 1)</li>
                  <li className="flex items-center gap-2 font-bold text-green-600"><ArrowRight className="h-3 w-3" /> Dikirim (Admin UMKM)</li>
                </ul>
              </div>
              <div className="p-4 bg-white rounded-lg border shadow-sm">
                <h4 className="font-bold text-xs uppercase mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-orange-500" />
                  Alur Tipe B (COD)
                </h4>
                <ul className="text-xs space-y-2 text-muted-foreground">
                  <li className="flex items-center gap-2"><ArrowRight className="h-3 w-3" /> Dipesan (Oleh Customer)</li>
                  <li className="flex items-center gap-2"><ArrowRight className="h-3 w-3" /> Diproses (Pengerjaan Mitra)</li>
                  <li className="flex items-center gap-2"><ArrowRight className="h-3 w-3" /> Dikumpulkan (Siap di Pos 1)</li>
                  <li className="flex items-center gap-2 font-bold text-green-600"><ArrowRight className="h-3 w-3" /> Dikirim dan Bayar (Admin UMKM)</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col items-center gap-4 pt-4">
          <Button asChild size="lg" className="w-full md:w-auto font-bold px-12">
            <Link href="/">Mulai Pesan Sekarang</Link>
          </Button>
          <Button asChild variant="ghost" className="text-muted-foreground">
            <Link href="/orders">Lihat Riwayat Pesanan Saya</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
