
import { NextResponse } from 'next/server';

/**
 * Endpoint untuk menerima POST request dari WhatsApp Provider (WasenderAPI, dsb).
 * URL ini: https://takjilku.netlify.app/webhook
 */
export async function POST(req: Request) {
  try {
    const data = await req.json();
    
    // Log data yang masuk untuk debugging
    console.log('Incoming Webhook from WhatsApp Provider:', JSON.stringify(data, null, 2));

    /**
     * Logika sinkronisasi status pesan atau balasan otomatis bisa ditambahkan di sini.
     */

    return NextResponse.json({ 
      success: true, 
      message: 'Webhook receiver active' 
    }, { status: 200 });
  } catch (error) {
    console.error('Webhook Receiver Error:', error);
    return NextResponse.json({ 
      error: 'Invalid payload' 
    }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({ 
    status: 'Webhook receiver is active',
    instruction: 'Set this URL in your WhatsApp Provider dashboard as the destination for POST requests.'
  });
}
