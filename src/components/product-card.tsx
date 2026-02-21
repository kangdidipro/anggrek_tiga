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
        {/* Layout Thumbnail Kecil + Info Teks */}
        <div className="flex gap-3 items-start mb-3">
          {/* Kontainer Foto Thumbnail */}
          <div className="relative h-20 w-20 shrink-0 bg-muted overflow-hidden flex items-center justify-center rounded-lg border border-primary/5 shadow-sm bg-white">
            {product.imageUrl ? (
              <Image
                src={product.imageUrl}
                alt={product.name}
                fill
                className="object-cover"
                sizes="80px"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-muted-foreground/40 p-2">
                <ImageOff className="h-6 w-6" />
                <span className="text-[8px] font-bold uppercase tracking-tighter text-center mt-1 leading-none">Foto tidak tersedia</span>
              </div>
            )}
            
            {!isAvailable && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
                <Badge variant="destructive" className="text-[8px] h-4 px-1 py-0 font-bold uppercase tracking-tighter">
                  OFF
                </Badge>
              </div>
            )}
          </div>

          {/* Info Produk Utama */}
          <div className="flex-1 min-w-0">
            <div className="flex justify-between text-[9px] text-muted-foreground mb-1 uppercase font-mono tracking-tighter">
              <span>SKU: {product.sku}</span>
            </div>
            
            <CardTitle className="text-sm font-bold leading-tight line-clamp-2 mb-1 h-10">
              {product.name}
            </CardTitle>

            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Store className="h-2.5 w-2.5 text-primary/70 shrink-0" />
              <span className="font-semibold truncate">{vendorName || product.vendor}</span>
              <span className="bg-muted px-1 rounded font-mono text-[8px]">({product.vendor})</span>
            </div>
          </div>
        </div>

        {/* Pesan Ketersediaan */}
        {!isVendorActive ? (
          <div className="bg-destructive/10 text-destructive text-[9px] font-bold py-1 px-2 rounded mb-3 border border-destructive/20 flex items-center justify-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Mitra sedang tidak aktif
          </div>
        ) : !isProductActive ? (
          <div className="bg-destructive/10 text-destructive text-[9px] font-bold py-1 px-2 rounded mb-3 border border-destructive/20 flex items-center justify-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Produk tidak tersedia
          </div>
        ) : null}

        {/* Harga dan Stok */}
        <div className="mt-auto pt-2 border-t border-dashed border-primary/10">
          <div className="flex items-center justify-between">
            <p className="text-lg font-bold text-primary">{formatPrice(product.price)}</p>
            {isAvailable && !isOutOfStock && (
              <Badge variant={currentStock <= 5 ? "secondary" : "outline"} className="text-[9px] px-1.5 py-0 h-5 font-mono">
                STOK: {currentStock}
              </Badge>
            )}
            {isAvailable && isOutOfStock && (
              <Badge variant="destructive" className="text-[9px] px-1.5 py-0 h-5 font-mono">
                HABIS
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
      <CardFooter className="p-4 pt-0">
        {!isAvailable ? (
          <Button className="w-full font-bold h-9 text-xs" variant="outline" disabled>
            Tidak Tersedia
          </Button>
        ) : !mounted || quantity === 0 ? (
          <Button 
            className="w-full font-bold h-10" 
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
