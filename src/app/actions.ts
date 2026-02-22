'use server';

import { z } from 'zod';
import type { OrderPayload } from '@/lib/types';
import { redirect } from 'next/navigation';
import nodemailer from 'nodemailer';

const orderSchema = z.object({
  name: z.string().min(1, 'Nama wajib diisi'),
  email: z.string().email('Email tidak valid').or(z.literal('')).optional(),
  phone: z.string().min(10, 'Nomor HP tidak valid'),
  address: z.string().min(10, 'Alamat tidak valid'),
  paymentMethod: z.enum(['QRIS', 'COD']),
  items: z.array(z.object({
    id: z.string(),
    name: z.string(),
    sku: z.string(),
    quantity: z.number().min(1),
    price: z.number(),
  })).min(1, 'Keranjang tidak boleh kosong'),
  total: z.number(),
  deliveryFee: z.number(),
});

export type SmtpConfig = {
  host: string;
  port: string;
  user: string;
  pass: string;
  from: string;
};

export type MailOptions = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: {
    filename: string;
    content: string; // Base64 or Buffer
    encoding?: string;
  }[];
};

/**
 * Sends an email using SMTP configuration.
 */
export async function sendSmtpEmail(config: SmtpConfig, options: MailOptions) {
  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: parseInt(config.port),
      secure: config.port === '465', // true for 465, false for other ports
      auth: {
        user: config.user,
        pass: config.pass,
      },
      connectionTimeout: 10000,
    });

    let fromAddress = config.user;
    
    if (config.from) {
      let displayName = config.from;
      if (config.from.includes('<')) {
        displayName = config.from.split('<')[0].trim();
      }
      
      if (displayName && !displayName.includes('@')) {
        fromAddress = `"${displayName}" <${config.user}>`;
      } else {
        fromAddress = config.user;
      }
    }

    const info = await transporter.sendMail({
      from: fromAddress,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      attachments: options.attachments?.map(att => ({
        filename: att.filename,
        content: Buffer.from(att.content.split('base64,')[1] || att.content, 'base64'),
      })),
    });

    console.log('Email sent successfully: %s', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error('SMTP Send Error details:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Sends order data to a WhatsApp Webhook/API (WasenderAPI).
 * Format to JID automatically to avoid "valid WhatsApp JID" errors.
 */
export async function sendWhatsAppWebhook(url: string, payload: any, token?: string) {
  if (!url) return { success: false, error: 'Webhook URL tidak dikonfigurasi' };
  
  // Security check: Avoid local loops
  const currentDomain = process.env.NEXT_PUBLIC_VERCEL_URL || 'takjilku.netlify.app';
  if (url.includes(currentDomain) || url.includes('localhost')) {
    return { success: false, error: 'URL salah! Gunakan URL API dari Wasender (bukan URL web sendiri).' };
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
      headers['X-API-Key'] = token; 
      headers['api-key'] = token;
    }
    
    // FORMATTING TO JID: Essential for WasenderAPI (Baileys based)
    let rawTo = (payload.to || payload.customerPhone || '').toString().trim();
    let formattedTo = rawTo;

    if (rawTo && !rawTo.includes('@')) {
      // Clean non-numeric characters
      let clean = rawTo.replace(/[^0-9]/g, '');
      // Auto-convert local Indonesian format (08... -> 628...)
      if (clean.startsWith('0')) {
        clean = '62' + clean.substring(1);
      }
      // Append JID suffix if it's strictly numeric
      if (clean) {
        formattedTo = `${clean}@s.whatsapp.net`;
      }
    }

    const finalPayload = {
      ...payload,
      to: formattedTo,
      text: payload.text || payload.message,
      api_key: token 
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(finalPayload),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      let displayMsg = `Error ${response.status}`;
      
      try {
        const json = JSON.parse(errorText);
        displayMsg = json.message || displayMsg;
      } catch (e) {
        displayMsg = errorText.substring(0, 100) || displayMsg;
      }

      if (response.status === 429) {
        displayMsg = "Limit tercapai (Akun Trial: Maks 1 pesan / menit). Silakan tunggu sebentar.";
      }

      throw new Error(displayMsg);
    }
    
    return { success: true };
  } catch (error: any) {
    console.error('WhatsApp Webhook Error:', error);
    return { success: false, error: error.message };
  }
}

export async function submitOrder(payload: OrderPayload) {
  try {
    orderSchema.parse(payload);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, message: 'Validasi gagal', errors: error.errors };
    }
    console.error('Order submission error:', error);
    return { success: false, message: 'Terjadi kesalahan saat mengirim pesanan.' };
  }
  
  redirect('/order-success');
}
