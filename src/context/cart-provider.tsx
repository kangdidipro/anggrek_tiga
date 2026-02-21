'use client';

import type { CartItem, Product } from '@/lib/types';
import React, { createContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (product: Product) => void;
  updateItemQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getItemQuantity: (productId: string) => number;
  totalItems: number;
  cartTotal: number;
  deliveryFeeTotal: number;
}

export const CartContext = createContext<CartContextType | undefined>(undefined);

const isBrowser = typeof window !== 'undefined';

export function CartProvider({ children }: { children: React.ReactNode }) {
  const firestore = useFirestore();
  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    if (!isBrowser) return [];
    try {
      const item = window.localStorage.getItem('cart');
      return item ? JSON.parse(item) : [];
    } catch (error) {
      console.error(error);
      return [];
    }
  });

  // Fetch Delivery Fee from DB
  const settingsDocRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'settings', 'inventory');
  }, [firestore]);
  const { data: settings } = useDoc<{ deliveryFee?: number }>(settingsDocRef);
  const deliveryFeeBase = settings?.deliveryFee ?? 2500;

  useEffect(() => {
    if (!isBrowser) return;
    try {
      window.localStorage.setItem('cart', JSON.stringify(cartItems));
    } catch (error) {
      console.error(error);
    }
  }, [cartItems]);

  const addToCart = useCallback((product: Product) => {
    setCartItems((prevItems) => {
      const existingItem = prevItems.find((item) => item.product.id === product.id);
      if (existingItem) {
        return prevItems.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prevItems, { product, quantity: 1 }];
    });
  }, []);

  const updateItemQuantity = useCallback((productId: string, quantity: number) => {
    setCartItems((prevItems) => {
      if (quantity <= 0) {
        return prevItems.filter((item) => item.product.id !== productId);
      }
      return prevItems.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item
      );
    });
  }, []);

  const clearCart = useCallback(() => {
    setCartItems([]);
  }, []);

  const getItemQuantity = useCallback((productId: string) => {
    const item = cartItems.find((item) => item.product.id === productId);
    return item ? item.quantity : 0;
  }, [cartItems]);

  const totalItems = cartItems.reduce((total, item) => total + item.quantity, 0);
  const cartTotal = cartItems.reduce((total, item) => total + item.product.price * item.quantity, 0);
  
  /**
   * Hitung total ongkir dinamis dari database.
   */
  const deliveryFeeTotal = useMemo(() => {
    if (cartItems.length === 0) return 0;
    return deliveryFeeBase;
  }, [cartItems, deliveryFeeBase]);

  const value = {
    cartItems,
    addToCart,
    updateItemQuantity,
    clearCart,
    getItemQuantity,
    totalItems,
    cartTotal,
    deliveryFeeTotal,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
