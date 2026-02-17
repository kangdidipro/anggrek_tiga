'use server';

import { z } from 'zod';
import type { OrderPayload } from '@/lib/types';
import { redirect } from 'next/navigation';
import * as fs from 'fs';
import * as xlsx from 'xlsx';

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

// The path to the Excel file
const dbPath = 'database.xlsx';

function saveOrderToExcel(payload: OrderPayload) {
  const orderData = {
    'Order ID': new Date().getTime().toString(),
    'Timestamp': new Date().toISOString(),
    'Name': payload.name,
    'Email': payload.email || '',
    'Phone': payload.phone,
    'Address': payload.address,
    'Payment Method': payload.paymentMethod,
    'Total': payload.total,
    'Delivery Fee': payload.deliveryFee,
    'Items': payload.items.map(item => `${item.name} (SKU: ${item.sku}, x${item.quantity})`).join(', '),
  };

  const sheetName = 'Orders';
  let workbook;
  let worksheet;

  const headers = [
    'Order ID',
    'Timestamp',
    'Name',
    'Email',
    'Phone',
    'Address',
    'Payment Method',
    'Total',
    'Delivery Fee',
    'Items'
  ];

  // Check if the file exists
  if (fs.existsSync(dbPath)) {
    workbook = xlsx.readFile(dbPath);
    worksheet = workbook.Sheets[sheetName];
    if (!worksheet) {
      worksheet = xlsx.utils.json_to_sheet([], { header: headers });
      xlsx.utils.book_append_sheet(workbook, worksheet, sheetName);
    }
  } else {
    workbook = xlsx.utils.book_new();
    worksheet = xlsx.utils.json_to_sheet([], { header: headers });
    xlsx.utils.book_append_sheet(workbook, worksheet, sheetName);
  }

  // Add the new order data
  xlsx.utils.sheet_add_json(worksheet, [orderData], {
    skipHeader: true,
    origin: -1,
  });

  // Write the workbook back to the file
  xlsx.writeFile(workbook, dbPath);
}

export async function submitOrder(payload: OrderPayload) {
  try {
    const validatedPayload = orderSchema.parse(payload);
    
    saveOrderToExcel(validatedPayload);

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
