'use server';

import { z } from 'zod';
import type { OrderPayload } from '@/lib/types';
import { redirect } from 'next/navigation';

const orderSchema = z.object({
  name: z.string().min(1, 'Nama wajib diisi'),
  email: z.string().email('Email tidak valid'),
  phone: z.string().min(10, 'Nomor HP tidak valid'),
  address: z.string().min(10, 'Alamat tidak valid'),
  paymentMethod: z.enum(['QRIS', 'COD']),
  items: z.array(z.object({
    id: z.string(),
    name: z.string(),
    quantity: z.number().min(1),
    price: z.number(),
  })).min(1, 'Keranjang tidak boleh kosong'),
  total: z.number(),
  deliveryFee: z.number(),
});

export async function submitOrder(payload: OrderPayload) {
  try {
    const validatedPayload = orderSchema.parse(payload);
    
    // In a real application, you would save this to a database or Google Sheet.
    // For now, we just log it to the console.
    console.log('New Order Submitted:', JSON.stringify(validatedPayload, null, 2));

    // Here you could integrate with a payment gateway for QRIS or just proceed for COD

  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, message: 'Validasi gagal', errors: error.errors };
    }
    console.error('Order submission error:', error);
    return { success: false, message: 'Terjadi kesalahan saat mengirim pesanan.' };
  }
  
  redirect('/order-success');
}
