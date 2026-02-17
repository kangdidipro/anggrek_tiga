'use client';

import Image from 'next/image';
import type { Product } from '@/lib/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/utils';
import { useCart } from '@/hooks/use-cart';
import { Plus, Minus } from 'lucide-react';

type ProductCardProps = {
  product: Product;
};

export default function ProductCard({ product }: ProductCardProps) {
  const { addToCart, updateItemQuantity, getItemQuantity } = useCart();
  const quantity = getItemQuantity(product.id);

  const handleIncrease = () => {
    updateItemQuantity(product.id, quantity + 1);
  };

  const handleDecrease = () => {
    updateItemQuantity(product.id, quantity - 1);
  };

  return (
    <Card className="flex flex-col h-full overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
      <CardHeader className="p-0">
        <div className="aspect-video relative">
          <Image
            src={product.image.url}
            alt={product.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            data-ai-hint={product.image.hint}
          />
        </div>
      </CardHeader>
      <CardContent className="p-4 flex-1 flex flex-col">
        <CardTitle className="text-base font-bold leading-snug tracking-tight mb-2 flex-1">
          {product.name}
        </CardTitle>
        <p className="text-lg font-semibold text-primary">{formatPrice(product.price)}</p>
      </CardContent>
      <CardFooter className="p-4 pt-0">
        {quantity === 0 ? (
          <Button className="w-full" onClick={() => addToCart(product)}>
            <Plus className="mr-2 h-4 w-4" />
            Tambah
          </Button>
        ) : (
          <div className="flex items-center justify-center w-full gap-2">
            <Button size="icon" variant="outline" onClick={handleDecrease}>
              <Minus className="h-4 w-4" />
            </Button>
            <span className="font-bold text-lg w-10 text-center">{quantity}</span>
            <Button size="icon" variant="outline" onClick={handleIncrease}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardFooter>
    </Card>
  );
}
