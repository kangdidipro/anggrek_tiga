export type Product = {
  id: string;
  name: string;
  price: number;
  category: string;
  image: {
    id: string;
    url: string;
    hint: string;
  };
};

export type CartItem = {
  product: Product;
  quantity: number;
};

export type OrderPayload = {
  name: string;
  email: string;
  phone: string;
  address: string;
  paymentMethod: 'QRIS' | 'COD';
  items: {
    id: string;
    name: string;
    quantity: number;
    price: number;
  }[];
  total: number;
  deliveryFee: number;
};
