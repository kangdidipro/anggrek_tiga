'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Database, Table, Info, Layers, LayoutGrid, UtensilsCrossed, ListOrdered, LayoutDashboard, UserRound, Users, Tags, Settings, ChevronRight } from 'lucide-react';

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
    description: 'Menyimpan konfigurasi sistem, terdiri dari dokumen "mail" (SMTP Server) dan "inventory" (Stok Default, Ongkir, Biaya Admin, Webhook).',
    icon: Database,
  },
];

const menuGuide = [
  {
    title: 'Atur Menu',
    icon: UtensilsCrossed,
    description: 'Pusat pengelolaan produk takjil. Digunakan untuk menambah menu, mengedit harga/stok, import data masal via Excel, serta mengatur apakah menu tersebut aktif (muncul di pelanggan) atau tidak.',
  },
  {
    title: 'List Order',
    icon: ListOrdered,
    description: 'Manajemen transaksi harian. Admin dapat melihat pesanan yang masuk, memantau progres per mitra, memperbarui status pengerjaan, serta mencetak struk digital pelanggan.',
  },
  {
    title: 'Rekap Harian',
    icon: LayoutDashboard,
    description: 'Analisis dan laporan keuangan. Menyajikan grafik tren penjualan, rincian omzet bruto, potongan admin, dan dana bersih (netto) yang harus dibayarkan ke masing-masing mitra UMKM.',
  },
  {
    title: 'Data Pelanggan',
    icon: UserRound,
    description: 'Database profil pemesan. Menyimpan riwayat alamat dan nomor WhatsApp warga untuk memudahkan koordinasi pengantaran oleh tim kurir karang taruna.',
  },
  {
    title: 'Master Grup',
    icon: LayoutGrid,
    description: 'Pengaturan level tertinggi untuk pengelompokan menu (cth: Makanan Utama, Minuman, Snack). Berguna untuk menyederhanakan navigasi pada halaman utama pelanggan.',
  },
  {
    title: 'Master Kategori',
    icon: Tags,
    description: 'Pengaturan kategori detail produk (cth: Nasi Bakar, Aneka Bubur). Setiap kategori harus dihubungkan ke salah satu Grup agar data terstruktur dengan baik.',
  },
  {
    title: 'Master Mitra',
    icon: Users,
    description: 'Kumpulan data penyedia makanan (UMKM). Admin mengelola kode unik mitra, nama brand, dan status keaktifan mitra di sini.',
  },
  {
    title: 'Pengaturan',
    icon: Settings,
    description: 'Pusat kendali sistem. Mengatur server email (SMTP), notifikasi WhatsApp, parameter biaya operasional (ongkir & admin fee), serta fitur cadangan (backup) data.',
  },
];

export default function TechnicalDataPage() {
  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight font-headline">Data Teknis & Panduan Menu</h1>
        <p className="text-muted-foreground">Arsitektur basis data dan penjelasan fungsi setiap fitur di Panel Admin TakjilKu.</p>
      </div>

      {/* Bagian 1: Penjelasan Menu */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b pb-2">
          <Info className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold font-headline">Panduan Fitur Panel Admin</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {menuGuide.map((item, index) => {
            const Icon = item.icon;
            return (
              <Card key={index} className="border-primary/5 hover:border-primary/20 transition-colors shadow-sm">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <div className="p-1.5 bg-primary/10 rounded-md">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    {item.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Bagian 2: Struktur Database */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b pb-2">
          <Database className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold font-headline">Struktur Basis Data (Firestore)</h2>
        </div>
        
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 text-sm leading-relaxed text-muted-foreground italic">
            "Aplikasi menggunakan database NoSQL Firestore yang dirancang dengan skema terdistribusi. Data transaksi (Orders) dipisahkan ke dalam sub-koleksi per pelanggan untuk menjamin performa pembacaan data yang cepat dan aman sesuai aturan Security Rules."
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {technicalInfo.map((item, index) => {
            const Icon = item.icon;
            return (
              <Card key={index} className="overflow-hidden border-muted/60">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-muted/20">
                  <CardTitle className="text-base font-mono font-bold text-foreground flex items-center gap-2">
                    <ChevronRight className="h-4 w-4 text-primary" />
                    {item.title}
                  </CardTitle>
                  <Badge variant={item.type.includes('Utama') ? 'default' : 'outline'} className="text-[10px] h-5">
                    {item.type}
                  </Badge>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="flex gap-3">
                    <div className="mt-1 h-8 w-8 rounded-full bg-primary/5 flex items-center justify-center shrink-0 border border-primary/10">
                      <Icon className="h-4 w-4 text-primary/70" />
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <footer className="pt-8 border-t text-center">
        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
          TakjilKu System Documentation • v1.5 • 2025
        </p>
      </footer>
    </div>
  );
}
