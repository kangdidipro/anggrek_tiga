'use client';

import { useState, useEffect } from 'react';
import type { Product } from '@/lib/types';
import { Card, CardContent, CardFooter, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/utils';
import { useCart } from '@/hooks/use-cart';
import { Plus, Minus, PackageX } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type ProductCardProps = {
  product: Product;
};

export default function ProductCard({ product }: ProductCardProps) {
  const { addToCart, updateItemQuantity, getItemQuantity } = useCart();
  const quantity = getItemQuantity(product.id);
  const [mounted, setMounted] = useState(false);

  // Pastikan stok memiliki nilai default 20 jika undefined (untuk data lama)
  const currentStock = product.stock ?? 20;

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleIncrease = () => {
    if (quantity < currentStock) {
      updateItemQuantity(product.id, quantity + 1);
    }
  };

  const handleDecrease = () => {
    updateItemQuantity(product.id, quantity - 1);
  };

  const isOutOfStock = currentStock <= 0;

  return (
    <Card className={`flex flex-col h-full overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${isOutOfStock ? 'opacity-75 grayscale-[0.5]' : ''}`}>
      <CardContent className="p-4 flex-1 flex flex-col">
        <div className="flex justify-between text-sm text-muted-foreground mb-2">
          <span>No: {product.id}</span>
          <span>SKU: {product.sku}</span>
        </div>
        <CardTitle className="text-base font-bold leading-snug tracking-tight mb-2 flex-1">
          {product.name}
        </CardTitle>
        <div className="flex items-center justify-between mt-auto">
          <p className="text-lg font-semibold text-primary">{formatPrice(product.price)}</p>
          <div className="text-right">
             <Badge variant={isOutOfStock ? "destructive" : currentStock <= 5 ? "secondary" : "outline"} className="text-[10px] px-1.5 py-0 h-5">
               {isOutOfStock ? "Habis" : `Stok: ${currentStock}`}
             </Badge>
          </div>
        </div>
      </CardContent>
      <CardFooter className="p-4 pt-0">
        {!mounted || quantity === 0 ? (
          <Button 
            className="w-full" 
            onClick={() => addToCart(product)} 
            disabled={isOutOfStock}
          >
            {isOutOfStock ? (
              <><PackageX className="mr-2 h-4 w-4" /> Stok Habis</>
            ) : (
              <><Plus className="mr-2 h-4 w-4" /> Tambah</>
            )}
          </Button>
        ) : (
          <div className="flex items-center justify-center w-full gap-2">
            <Button size="icon" variant="outline" onClick={handleDecrease}>
              <Minus className="h-4 w-4" />
            </Button>
            <span className="font-bold text-lg w-10 text-center">{quantity}</span>
            <Button 
              size="icon" 
              variant="outline" 
              onClick={handleIncrease} 
              disabled={quantity >= currentStock}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardFooter>
    </Card>
  );
}
