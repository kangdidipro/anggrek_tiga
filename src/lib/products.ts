import type { Product } from '@/lib/types';
import * as fs from 'fs';
import * as xlsx from 'xlsx';

const dbPath = 'database.xlsx';
const menuSheetName = 'daftar_menu';
const ordersSheetName = 'Orders';

const hardcodedProducts: Product[] = [
  // Nasi & Lauk
  { id: '1', name: 'Nasi Bakar Ayam', price: 12000, category: 'Nasi & Lauk' },
  { id: '2', name: 'Nasi Bakar Cakalang', price: 12000, category: 'Nasi & Lauk' },
  { id: '3', name: 'Nasi Kebuli Kari Ayam', price: 22000, category: 'Nasi & Lauk' },
  { id: '4', name: 'Nasi Lemak Telur Balodo', price: 15000, category: 'Nasi & Lauk' },
  { id: '11', name: 'Rice Bowl Daun Jeruk Chicken Pop Corn', price: 18000, category: 'Nasi & Lauk' },
  { id: '27', name: 'Ayam Tangkap Goreng khas Aceh', price: 20000, category: 'Nasi & Lauk' },
  { id: '32', name: 'Rendang Padang', price: 18000, category: 'Nasi & Lauk' },

  // Mie & Soto
  { id: '5', name: 'Bakso Urat', price: 18000, category: 'Mie & Soto' },
  { id: '7', name: 'Soto Mie', price: 15000, category: 'Mie & Soto' },
  { id: '8', name: 'Mie Aceh Goreng', price: 18000, category: 'Mie & Soto' },
  { id: '9', name: 'Mihun Goreng', price: 18000, category: 'Mie & Soto' },
  { id: '10', name: 'Mie golosor daun pisang', price: 7000, category: 'Mie & Soto' },
  
  // Pempek
  { id: '12', name: 'Pempek Campur Telor kecil', price: 22000, category: 'Pempek' },
  { id: '14', name: 'Pempek Kapal Selem Besar', price: 18000, category: 'Pempek' },
  { id: '15', name: 'TEKWAN', price: 18000, category: 'Pempek' },
  { id: '16', name: 'Frozen Vacum Pempek kecil Campur isi 15', price: 65000, category: 'Pempek' },

  // Jajanan Asin
  { id: '40', name: 'Bakwan Goreng', price: 2000, category: 'Jajanan Asin' },
  { id: '41', name: 'Tahu Bakso Goreng', price: 3000, category: 'Jajanan Asin' },
  { id: '42', name: 'Tahu Isi Goreng', price: 2500, category: 'Jajanan Asin' },
  { id: '50', name: 'Risol Mihun', price: 3000, category: 'Jajanan Asin' },
  { id: '52', name: 'Pastel Sayur', price: 4000, category: 'Jajanan Asin' },
  { id: '96', name: 'Lontong Isi Oncom', price: 2000, category: 'Jajanan Asin' },
  { id: '98', name: 'Pisang Goreng', price: 2000, category: 'Jajanan Asin' },
  
  // Jajanan Manis
  { id: '56', name: 'Klepon Gula Merah @4 pcs / pack', price: 5000, category: 'Jajanan Manis' },
  { id: '57', name: 'Kolak Pisang, Ubi, Kolang-kaling', price: 10000, category: 'Jajanan Manis' },
  { id: '58', name: 'Kue Lumpur Labu Kuning', price: 2500, category: 'Jajanan Manis' },
  { id: '81', name: 'Dadar Gulung Isi Kelapa', price: 2500, category: 'Jajanan Manis' },
  { id: '90', name: 'Donat Jadul Gula', price: 7000, category: 'Jajanan Manis' },

  // Bubur & Puding
  { id: '63', name: 'Puding Susu Coklat', price: 4000, category: 'Bubur & Puding' },
  { id: '68', name: 'Bubur Sumsum', price: 6000, category: 'Bubur & Puding' },
  { id: '69', name: 'Bubur Ketan Hitam', price: 6000, category: 'Bubur & Puding' },
  { id: '70', name: 'Bubur Kacang Hijau', price: 6000, category: 'Bubur & Puding' },
];

function initializeMenuSheet(workbook: xlsx.WorkBook) {
    const productSheetData = hardcodedProducts.map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        category: p.category,
    }));
    const worksheet = xlsx.utils.json_to_sheet(productSheetData);
    xlsx.utils.book_append_sheet(workbook, worksheet, menuSheetName);
}

function getProducts(): Product[] {
    try {
        if (fs.existsSync(dbPath)) {
            const workbook = xlsx.readFile(dbPath);
            let worksheet = workbook.Sheets[menuSheetName];

            if (!worksheet) {
                // Menu sheet doesn't exist, so add it and save.
                initializeMenuSheet(workbook);
                xlsx.writeFile(workbook, dbPath);
                return hardcodedProducts;
            }

            const data = xlsx.utils.sheet_to_json(worksheet) as any[];
            if (data.length > 0) {
                const parsedProducts = data.map(row => {
                  // Basic validation
                  if (row.id && row.name && row.price && row.category) {
                    return {
                      id: String(row.id),
                      name: String(row.name),
                      price: Number(row.price),
                      category: String(row.category),
                    };
                  }
                  return null;
                }).filter((p): p is Product => p !== null);
                
                if (parsedProducts.length > 0) {
                  return parsedProducts;
                }
            }
        }

        // File does not exist, or sheet was empty. Create/re-create with default data.
        const workbook = xlsx.utils.book_new();
        initializeMenuSheet(workbook);

        // Also ensure Orders sheet exists, as this might be the first time the file is created.
        if (!workbook.Sheets[ordersSheetName]) {
            const ordersWorksheet = xlsx.utils.json_to_sheet([], { header: [
                'Order ID', 'Timestamp', 'Name', 'Email', 'Phone', 'Address', 
                'Payment Method', 'Total', 'Delivery Fee', 'Items'
            ]});
            xlsx.utils.book_append_sheet(workbook, ordersWorksheet, ordersSheetName);
        }

        xlsx.writeFile(workbook, dbPath);
        return hardcodedProducts;

    } catch (error) {
        console.error("Error with database.xlsx, falling back to hardcoded products.", error);
        return hardcodedProducts;
    }
}

export const products: Product[] = getProducts();
