
export type Product = {
  id: string;
  name: string;
  price: number;
  category: string;
  sku: string;
  vendor: string;
  stock: number;
  isActive?: boolean;
};

export type Vendor = {
  id: string;
  name: string;
  code: string;
  email?: string;
  phoneNumber?: string;
  isActive?: boolean;
};

export type CartItem = {
  product: Product;
  quantity: number;
};

export type OrderPayload = {
  name: string;
  email?: string;
  phone: string;
  address: string;
  paymentMethod: 'QRIS' | 'COD';
  items: {
    id: string;
    name: string;
    sku: string;
    quantity: number;
    price: number;
    vendor: string;
  }[];
  total: number;
  deliveryFee: number;
};
