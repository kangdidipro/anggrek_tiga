'use client';

import { useState, useEffect } from 'react';
import type { Product } from '@/lib/types';
import { Card, CardContent, CardFooter, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/utils';
import { useCart } from '@/hooks/use-cart';
import { Plus, Minus, PackageX, Store, AlertCircle, ImageOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import Image from 'next/image';

type ProductCardProps = {
  product: Product;
  vendorName?: string;
  isVendorActive?: boolean;
};

export default function ProductCard({ product, vendorName, isVendorActive = true }: ProductCardProps) {
  const { addToCart, updateItemQuantity, getItemQuantity } = useCart();
  const quantity = getItemQuantity(product.id);
  const [mounted, setMounted] = useState(false);

  const dbStock = product.stock ?? 20;
  const currentStock = Math.max(0, dbStock);
  const isProductActive = product.isActive !== false;

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
  const isAvailable = isVendorActive && isProductActive;
  const isDisabled = !isAvailable || isOutOfStock;

  return (
    <Card className={cn(
      "flex flex-col h-full overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1",
      isDisabled ? 'opacity-75 grayscale-[0.5]' : ''
    )}>
      <CardContent className="p-4 flex-1 flex flex-col">
        {/* Foto produk kini berada di dalam CardContent */}
        <div className="relative aspect-[4/3] w-full bg-muted overflow-hidden flex items-center justify-center rounded-md mb-4 border border-primary/5">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.name}
              fill
              className="object-cover transition-transform duration-500 hover:scale-110"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground/60">
              <ImageOff className="h-10 w-10 stroke-[1.5]" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-center px-4">Foto tidak tersedia</span>
            </div>
          )}
          
          {!isAvailable && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center p-4 text-center z-10">
              <Badge variant="destructive" className="text-[10px] font-bold uppercase tracking-wider">
                Tidak Tersedia
              </Badge>
            </div>
          )}
        </div>

        <div className="flex justify-between text-[10px] text-muted-foreground mb-2 uppercase font-mono tracking-tighter">
          <span>ID: {product.id}</span>
          <span>SKU: {product.sku}</span>
        </div>
        
        <CardTitle className="text-base font-bold leading-snug tracking-tight mb-1">
          {product.name}
        </CardTitle>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
          <Store className="h-3 w-3 text-primary/70" />
          <span className="font-semibold">{vendorName || product.vendor}</span>
          <span className="bg-muted px-1 rounded font-mono">({product.vendor})</span>
        </div>

        {!isVendorActive ? (
          <div className="bg-destructive/10 text-destructive text-[10px] font-bold py-1.5 px-2 rounded-md mb-4 text-center border border-destructive/20 flex items-center justify-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Untuk sementara mitra tidak aktif
          </div>
        ) : !isProductActive ? (
          <div className="bg-destructive/10 text-destructive text-[10px] font-bold py-1.5 px-2 rounded-md mb-4 text-center border border-destructive/20 flex items-center justify-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Untuk sementara produk tidak tersedia
          </div>
        ) : null}

        <div className="mt-auto">
          <div className="flex items-center justify-between">
            <p className="text-lg font-bold text-primary">{formatPrice(product.price)}</p>
            {isAvailable && !isOutOfStock && (
              <Badge variant={currentStock <= 5 ? "secondary" : "outline"} className="text-[10px] px-1.5 py-0 h-5">
                Stok: {currentStock}
              </Badge>
            )}
            {isAvailable && isOutOfStock && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5">
                Habis
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
      <CardFooter className="p-4 pt-0">
        {!isAvailable ? (
          <Button className="w-full font-bold" variant="outline" disabled>
            Tidak Tersedia
          </Button>
        ) : !mounted || quantity === 0 ? (
          <Button 
            className="w-full font-bold" 
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
          <div className="flex items-center justify-center w-full gap-3">
            <Button size="icon" variant="outline" onClick={handleDecrease} className="h-9 w-9 border-primary/20 hover:bg-primary/5">
              <Minus className="h-4 w-4" />
            </Button>
            <span className="font-bold text-xl w-8 text-center text-primary">{quantity}</span>
            <Button 
              size="icon" 
              variant="outline" 
              onClick={handleIncrease} 
              disabled={quantity >= currentStock}
              className="h-9 w-9 border-primary/20 hover:bg-primary/5"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardFooter>
    </Card>
  );
}