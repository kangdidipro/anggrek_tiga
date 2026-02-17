'use server';

import { z } from 'zod';
import type { OrderPayload } from '@/lib/types';
import { redirect } from 'next/navigation';

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

// This function is no longer called by the form, but is kept for potential future use.
// The form now writes directly to Firestore on the client side.
export async function submitOrder(payload: OrderPayload) {
  try {
    orderSchema.parse(payload);
    // Previously, this function saved data to an Excel file.
    // This logic has been moved to the client-side to write to Firestore directly.
    console.log("submitOrder server action called, but it no longer saves data.");

  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, message: 'Validasi gagal', errors: error.errors };
    }
    console.error('Order submission error:', error);
    return { success: false, message: 'Terjadi kesalahan saat mengirim pesanan.' };
  }
  
  // Redirect is still here but the action is not called from the main order form.
  redirect('/order-success');
}
