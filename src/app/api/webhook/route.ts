
import { NextResponse } from 'next/server';

/**
 * Endpoint untuk menerima POST request dari WhatsApp Provider (WasenderAPI, dsb).
 * Digunakan untuk menangani event seperti messages.received atau status update.
 */
export async function POST(req: Request) {
  try {
    const data = await req.json();
    
    // Log incoming data for debugging in development
    console.log('Incoming Webhook from WhatsApp Provider:', JSON.stringify(data, null, 2));

    /**
     * Anda bisa menambahkan logika di sini, misalnya:
     * - Update status pesanan jika menerima kata kunci tertentu.
     * - Balas pesan otomatis.
     * - Simpan riwayat chat ke database.
     */

    return NextResponse.json({ 
      success: true, 
      message: 'Webhook received successfully' 
    }, { status: 200 });
  } catch (error) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ 
      error: 'Invalid payload or server error' 
    }, { status: 400 });
  }
}

// Menangani permintaan GET untuk verifikasi endpoint jika dibutuhkan oleh beberapa provider
export async function GET() {
  return NextResponse.json({ status: 'Webhook endpoint is active' });
}
