'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Database, Table, Info, Layers } from 'lucide-react';

const technicalInfo = [
  {
    title: 'menuItems',
    type: 'Koleksi Utama',
    description: 'Menyimpan daftar menu makanan/minuman, harga, SKU, kategori, dan jumlah stok yang tersedia.',
    icon: Table,
  },
  {
    title: 'vendors',
    type: 'Koleksi Utama',
    description: 'Menyimpan data master mitra atau unit UMKM yang menyediakan makanan (Nama, Kode Mitra, Email, No HP).',
    icon: Table,
  },
  {
    title: 'customers',
    type: 'Koleksi Utama',
    description: 'Menyimpan profil singkat pengguna yang melakukan pemesanan (Nama, No HP, Alamat Terakhir).',
    icon: Table,
  },
  {
    title: 'orders',
    type: 'Sub-koleksi (Pelanggan)',
    description: 'Berada di dalam koleksi pelanggan, menyimpan ringkasan pesanan seperti Total Bayar, Ongkir, Alamat, Status, dan Riwayat Status.',
    icon: Layers,
  },
  {
    title: 'orderItems',
    type: 'Sub-koleksi (Pesanan)',
    description: 'Berada di dalam koleksi pesanan, menyimpan detail item apa saja yang dibeli (nama produk, quantity, dan harga saat dipesan).',
    icon: Layers,
  },
  {
    title: 'settings',
    type: 'Koleksi Sistem',
    description: 'Menyimpan konfigurasi sistem, terdiri dari dokumen "mail" (SMTP Server) dan "inventory" (Stok Default).',
    icon: Database,
  },
];

export default function TechnicalDataPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-headline">Data Teknis TakjilKu</h1>
        <p className="text-muted-foreground">Dokumentasi arsitektur dan struktur basis data aplikasi.</p>
      </div>

      <Card className="bg-primary/5 border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-primary">
            <Info className="h-5 w-5" />
            Arsitektur Sistem
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm leading-relaxed text-muted-foreground italic">
          "Di aplikasi TakjilKu ini, terdapat 6 &quot;tabel&quot; (koleksi dan sub-koleksi) utama di database Firestore yang saling terintegrasi. 
          Struktur ini dirancang agar aplikasi tetap ringan namun mampu menangani rekap harian per mitra secara akurat."
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {technicalInfo.map((item, index) => {
          const Icon = item.icon;
          return (
            <Card key={index} className="overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg font-mono font-bold text-foreground">
                  {item.title}
                </CardTitle>
                <Badge variant={item.type.includes('Utama') ? 'default' : 'outline'}>
                  {item.type}
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  <div className="mt-1 h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
