# Firebase Studio - Ramadhan Takjil Order

Aplikasi pemesanan Takjil Ramadhan yang dibangun dengan Next.js, Firebase, dan Genkit AI.

## Fitur Utama
- **Landing Page**: Menu takjil interaktif.
- **AI Recommendation**: Rekomendasi menu berdasarkan waktu (pagi/siang/sore).
- **Cart System**: Keranjang belanja dengan perhitungan otomatis.
- **Admin Panel**: Manajemen pesanan, rekap harian, ekspor Excel/PDF, dan pengiriman laporan via email.

## Cara Push ke GitHub (SSH)
Ikuti langkah berikut di terminal Firebase Studio untuk menyimpan kode ke repositori Anda:

1. **Generate SSH Key** (Lewati jika sudah ada):
   `ssh-keygen -t ed25519 -C "email@anda.com"`
   *Tekan Enter terus sampai selesai.*

2. **Salin Public Key**:
   `cat ~/.ssh/id_ed25519.pub`
   *Salin hasilnya dan tambahkan ke [GitHub SSH Settings](https://github.com/settings/keys).*

3. **Inisialisasi & Set Remote SSH**:
   Jika Anda mendapatkan error "No such remote 'origin'", gunakan perintah `add` berikut:
   ```bash
   git init
   git remote add origin git@github.com:kangdidipro/anggrek_tiga.git
   ```

4. **Simpan & Push Kode**:
   ```bash
   git add .
   git commit -m "Initial commit from Firebase Studio"
   git branch -M main
   git push -u origin main
   ```

## Teknologi
- **Next.js 15** (App Router)
- **Firebase** (Auth & Firestore)
- **Genkit AI** (Google Gemini)
- **Tailwind CSS** & **ShadCN UI**
- **Libraries**: `jspdf`, `xlsx`, `date-fns`
