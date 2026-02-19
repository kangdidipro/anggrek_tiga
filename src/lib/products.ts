
import type { Product } from '@/lib/types';

export const products: Product[] = [
  // Nasi & Lauk
  { id: '1', name: 'Nasi Bakar Ayam', price: 12000, category: 'Nasi & Lauk', sku: 'NL-001', vendor: 'NL', stock: 50 },
  { id: '2', name: 'Nasi Bakar Cakalang', price: 12000, category: 'Nasi & Lauk', sku: 'NL-002', vendor: 'NL', stock: 50 },
  { id: '3', name: 'Nasi Kebuli Kari Ayam', price: 22000, category: 'Nasi & Lauk', sku: 'NL-003', vendor: 'NL', stock: 30 },
  { id: '4', name: 'Nasi Lemak Telur Balodo', price: 15000, category: 'Nasi & Lauk', sku: 'NL-004', vendor: 'NL', stock: 40 },
  { id: '11', name: 'Rice Bowl Daun Jeruk Chicken Pop Corn', price: 18000, category: 'Nasi & Lauk', sku: 'NL-005', vendor: 'NL', stock: 25 },
  { id: '27', name: 'Ayam Tangkap Goreng khas Aceh', price: 20000, category: 'Nasi & Lauk', sku: 'NL-006', vendor: 'NL', stock: 20 },
  { id: '32', name: 'Rendang Padang', price: 18000, category: 'Nasi & Lauk', sku: 'NL-007', vendor: 'NL', stock: 30 },

  // Mie & Soto
  { id: '5', name: 'Bakso Urat', price: 18000, category: 'Mie & Soto', sku: 'MS-001', vendor: 'MS', stock: 40 },
  { id: '7', name: 'Soto Mie', price: 15000, category: 'Mie & Soto', sku: 'MS-002', vendor: 'MS', stock: 40 },
  { id: '8', name: 'Mie Aceh Goreng', price: 18000, category: 'Mie & Soto', sku: 'MS-003', vendor: 'MS', stock: 35 },
  { id: '9', name: 'Mihun Goreng', price: 18000, category: 'Mie & Soto', sku: 'MS-004', vendor: 'MS', stock: 35 },
  { id: '10', name: 'Mie golosor daun pisang', price: 7000, category: 'Mie & Soto', sku: 'MS-005', vendor: 'MS', stock: 60 },
  
  // Pempek
  { id: '12', name: 'Pempek Campur Telor kecil', price: 22000, category: 'Pempek', sku: 'P-001', vendor: 'P', stock: 20 },
  { id: '14', name: 'Pempek Kapal Selem Besar', price: 18000, category: 'Pempek', sku: 'P-002', vendor: 'P', stock: 25 },
  { id: '15', name: 'TEKWAN', price: 18000, category: 'Pempek', sku: 'P-003', vendor: 'P', stock: 30 },
  { id: '16', name: 'Frozen Vacum Pempek kecil Campur isi 15', price: 65000, category: 'Pempek', sku: 'P-004', vendor: 'P', stock: 15 },

  // Jajanan Asin
  { id: '40', name: 'Bakwan Goreng', price: 2000, category: 'Jajanan Asin', sku: 'JA-001', vendor: 'JA', stock: 100 },
  { id: '41', name: 'Tahu Bakso Goreng', price: 3000, category: 'Jajanan Asin', sku: 'JA-002', vendor: 'JA', stock: 80 },
  { id: '42', name: 'Tahu Isi Goreng', price: 2500, category: 'Jajanan Asin', sku: 'JA-003', vendor: 'JA', stock: 80 },
  { id: '50', name: 'Risol Mihun', price: 3000, category: 'Jajanan Asin', sku: 'JA-004', vendor: 'JA', stock: 60 },
  { id: '52', name: 'Pastel Sayur', price: 4000, category: 'Jajanan Asin', sku: 'JA-005', vendor: 'JA', stock: 50 },
  { id: '96', name: 'Lontong Isi Oncom', price: 2000, category: 'Jajanan Asin', sku: 'JA-006', vendor: 'JA', stock: 100 },
  { id: '98', name: 'Pisang Goreng', price: 2000, category: 'Jajanan Asin', sku: 'JA-007', vendor: 'JA', stock: 100 },
  
  // Jajanan Manis
  { id: '56', name: 'Klepon Gula Merah @4 pcs / pack', price: 5000, category: 'Jajanan Manis', sku: 'JM-001', vendor: 'JM', stock: 40 },
  { id: '57', name: 'Kolak Pisang, Ubi, Kolang-kaling', price: 10000, category: 'Jajanan Manis', sku: 'JM-002', vendor: 'JM', stock: 50 },
  { id: '58', name: 'Kue Lumpur Labu Kuning', price: 2500, category: 'Jajanan Manis', sku: 'JM-003', vendor: 'JM', stock: 60 },
  { id: '81', name: 'Dadar Gulung Isi Kelapa', price: 2500, category: 'Jajanan Manis', sku: 'JM-004', vendor: 'JM', stock: 60 },
  { id: '90', name: 'Donat Jadul Gula', price: 7000, category: 'Jajanan Manis', sku: 'JM-005', vendor: 'JM', stock: 30 },

  // Bubur & Puding
  { id: '63', name: 'Puding Susu Coklat', price: 4000, category: 'Bubur & Puding', sku: 'BP-001', vendor: 'BP', stock: 40 },
  { id: '68', name: 'Bubur Sumsum', price: 6000, category: 'Bubur & Puding', sku: 'BP-002', vendor: 'BP', stock: 30 },
  { id: '69', name: 'Bubur Ketan Hitam', price: 6000, category: 'Bubur & Puding', sku: 'BP-003', vendor: 'BP', stock: 30 },
  { id: '70', name: 'Bubur Kacang Hijau', price: 6000, category: 'Bubur & Puding', sku: 'BP-004', vendor: 'BP', stock: 30 },
];
