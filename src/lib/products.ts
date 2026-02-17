import type { Product } from '@/lib/types';
import { PlaceHolderImages } from '@/lib/placeholder-images';

const getImage = (id: string) => {
  const image = PlaceHolderImages.find((img) => img.id === id);
  if (!image) {
    // Fallback image in case an ID is not found
    return { id: 'fallback', url: 'https://picsum.photos/seed/fallback/600/400', hint: 'food' };
  }
  return { id: image.id, url: image.imageUrl, hint: image.imageHint };
};

export const products: Product[] = [
  // Nasi & Lauk
  { id: '1', name: 'Nasi Bakar Ayam', price: 12000, category: 'Nasi & Lauk', image: getImage('prod_1') },
  { id: '2', name: 'Nasi Bakar Cakalang', price: 12000, category: 'Nasi & Lauk', image: getImage('prod_2') },
  { id: '3', name: 'Nasi Kebuli Kari Ayam', price: 22000, category: 'Nasi & Lauk', image: getImage('prod_3') },
  { id: '4', name: 'Nasi Lemak Telur Balodo', price: 15000, category: 'Nasi & Lauk', image: getImage('prod_4') },
  { id: '11', name: 'Rice Bowl Daun Jeruk Chicken Pop Corn', price: 18000, category: 'Nasi & Lauk', image: getImage('prod_11') },
  { id: '27', name: 'Ayam Tangkap Goreng khas Aceh', price: 20000, category: 'Nasi & Lauk', image: getImage('prod_27') },
  { id: '32', name: 'Rendang Padang', price: 18000, category: 'Nasi & Lauk', image: getImage('prod_32') },

  // Mie & Soto
  { id: '5', name: 'Bakso Urat', price: 18000, category: 'Mie & Soto', image: getImage('prod_5') },
  { id: '7', name: 'Soto Mie', price: 15000, category: 'Mie & Soto', image: getImage('prod_7') },
  { id: '8', name: 'Mie Aceh Goreng', price: 18000, category: 'Mie & Soto', image: getImage('prod_8') },
  { id: '9', name: 'Mihun Goreng', price: 18000, category: 'Mie & Soto', image: getImage('prod_9') },
  { id: '10', name: 'Mie golosor daun pisang', price: 7000, category: 'Mie & Soto', image: getImage('prod_10') },
  
  // Pempek
  { id: '12', name: 'Pempek Campur Telor kecil', price: 22000, category: 'Pempek', image: getImage('prod_12') },
  { id: '14', name: 'Pempek Kapal Selem Besar', price: 18000, category: 'Pempek', image: getImage('prod_14') },
  { id: '15', name: 'TEKWAN', price: 18000, category: 'Pempek', image: getImage('prod_15') },
  { id: '16', name: 'Frozen Vacum Pempek kecil Campur isi 15', price: 65000, category: 'Pempek', image: getImage('prod_16') },

  // Jajanan Asin
  { id: '40', name: 'Bakwan Goreng', price: 2000, category: 'Jajanan Asin', image: getImage('prod_40') },
  { id: '41', name: 'Tahu Bakso Goreng', price: 3000, category: 'Jajanan Asin', image: getImage('prod_41') },
  { id: '42', name: 'Tahu Isi Goreng', price: 2500, category: 'Jajanan Asin', image: getImage('prod_42') },
  { id: '50', name: 'Risol Mihun', price: 3000, category: 'Jajanan Asin', image: getImage('prod_50') },
  { id: '52', name: 'Pastel Sayur', price: 4000, category: 'Jajanan Asin', image: getImage('prod_52') },
  { id: '96', name: 'Lontong Isi Oncom', price: 2000, category: 'Jajanan Asin', image: getImage('prod_96') },
  { id: '98', name: 'Pisang Goreng', price: 2000, category: 'Jajanan Asin', image: getImage('prod_98') },
  
  // Jajanan Manis
  { id: '56', name: 'Klepon Gula Merah @4 pcs / pack', price: 5000, category: 'Jajanan Manis', image: getImage('prod_56') },
  { id: '57', name: 'Kolak Pisang, Ubi, Kolang-kaling', price: 10000, category: 'Jajanan Manis', image: getImage('prod_57') },
  { id: '58', name: 'Kue Lumpur Labu Kuning', price: 2500, category: 'Jajanan Manis', image: getImage('prod_58') },
  { id: '81', name: 'Dadar Gulung Isi Kelapa', price: 2500, category: 'Jajanan Manis', image: getImage('prod_81') },
  { id: '90', name: 'Donat Jadul Gula', price: 7000, category: 'Jajanan Manis', image: getImage('prod_90') },

  // Bubur & Puding
  { id: '63', name: 'Puding Susu Coklat', price: 4000, category: 'Bubur & Puding', image: getImage('prod_63') },
  { id: '68', name: 'Bubur Sumsum', price: 6000, category: 'Bubur & Puding', image: getImage('prod_68') },
  { id: '69', name: 'Bubur Ketan Hitam', price: 6000, category: 'Bubur & Puding', image: getImage('prod_69') },
  { id: '70', name: 'Bubur Kacang Hijau', price: 6000, category: 'Bubur & Puding', image: getImage('prod_70') },
];

export const deliveryFee = 2500;
