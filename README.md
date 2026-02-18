# Firebase Studio - Ramadhan Takjil Order

Aplikasi pemesanan Takjil Ramadhan yang dibangun dengan Next.js, Firebase, dan Genkit AI.

## Fitur Utama
- **Landing Page**: Menu takjil interaktif.
- **AI Recommendation**: Rekomendasi menu berdasarkan waktu (pagi/siang/sore).
- **Cart System**: Keranjang belanja dengan perhitungan otomatis.
- **Admin Panel**: Manajemen pesanan, rekap harian, ekspor Excel/PDF, dan pengiriman laporan via email.

## Cara Deploy / Push ke Git (SSH)
Jika Anda ingin menyimpan kode ini ke repositori Git pribadi (seperti GitHub) menggunakan SSH, ikuti langkah berikut di terminal:

1. **Generate SSH Key**:
   `ssh-keygen -t ed25519 -C "email@anda.com"`
2. **Copy Public Key**:
   `cat ~/.ssh/id_ed25519.pub` (Salin hasilnya ke pengaturan SSH di GitHub/GitLab).
3. **Set SSH Remote**:
   `git remote set-url origin git@github.com:username/repo-name.git`
4. **Push**:
   `git push origin main`

## Teknologi
- **Next.js 15** (App Router)
- **Firebase** (Auth & Firestore)
- **Genkit AI** (Google Gemini)
- **Tailwind CSS** & **ShadCN UI**
- **Libraries**: `jspdf`, `xlsx`, `date-fns`
