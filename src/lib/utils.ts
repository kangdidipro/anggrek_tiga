import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(price: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(price);
}

/**
 * Mendapatkan kode mitra dari SKU produk.
 * Mendukung format: "KODE-001" atau "KODE123"
 */
export function getVendorFromSku(sku: string) {
  if (!sku) return 'UNKNOWN';
  if (sku.includes('-')) return sku.split('-')[0];
  const match = sku.match(/^[a-zA-Z]+/);
  return match ? match[0] : sku;
}
