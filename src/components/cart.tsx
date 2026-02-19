'use client';

import { ShoppingCart, Trash2, Info, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from '@/components/ui/sheet';
import { useCart } from '@/hooks/use-cart';
import { formatPrice } from '@/lib/utils';
import OrderForm from './order-form';
import { Separator } from './ui/separator';
import { ScrollArea } from './ui/scroll-area';
import { deliveryFee } from '@/lib/constants';
import { useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { format, addDays } from 'date-fns';
import { id } from 'date-fns/locale';

export default function Cart() {
  const { cartItems, totalItems, cartTotal, clearCart } = useCart();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const finalTotal = cartTotal + deliveryFee;
  const deliveryDate = addDays(new Date(), 1);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <ShoppingCart className="h-5 w-5" />
          {mounted && totalItems > 0 && (
            <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {totalItems}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>Keranjang Belanja</SheetTitle>
        </SheetHeader>
        {cartItems.length > 0 ? (
          <>
            <ScrollArea className="flex-1 pr-6 -mr-6">
              <div className="py-4 space-y-6">
                <div className="space-y-4">
                  {cartItems.map(({ product, quantity }) => (
                    <div key={product.id} className="flex items-start gap-4 rounded-md border bg-card p-3 shadow-sm">
                      <div className="flex-1">
                        <p className="font-medium leading-tight">{product.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {quantity} x {formatPrice(product.price)}
                        </p>
                      </div>
                      <p className="font-semibold text-right text-sm">{formatPrice(product.price * quantity)}</p>
                    </div>
                  ))}
                </div>
              
                <Separator />
              
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span>Subtotal</span>
                        <span>{formatPrice(cartTotal)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Ongkos Antar</span>
                        <span>{formatPrice(deliveryFee)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-bold text-base">
                        <span>Total</span>
                        <span>{formatPrice(finalTotal)}</span>
                    </div>
                </div>

                <Separator />

                <Alert className="bg-primary/10 border-primary/20">
                  <Calendar className="h-4 w-4 text-primary" />
                  <AlertTitle className="font-bold text-primary">Jadwal Pengiriman (H+1)</AlertTitle>
                  <AlertDescription className="space-y-2">
                    <p className="text-xs">Pesanan Anda dijadwalkan untuk diantar pada:</p>
                    <p className="text-lg font-bold underline underline-offset-4 decoration-primary/30">
                      {format(deliveryDate, 'eeee, d MMMM yyyy', { locale: id })}
                    </p>
                    <p className="text-[10px] italic mt-2 opacity-70">
                      * Batas waktu pemesanan adalah jam 4 sore setiap harinya untuk pengiriman esok hari.
                    </p>
                  </AlertDescription>
                </Alert>

                <OrderForm cartItems={cartItems} total={finalTotal} deliveryFee={deliveryFee} setSheetOpen={setOpen} />
              </div>
            </ScrollArea>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <ShoppingCart className="h-16 w-16 text-muted-foreground" />
            <p className="text-muted-foreground">Keranjang belanja Anda kosong.</p>
          </div>
        )}
        <SheetFooter className="mt-auto pt-4 border-t">
          {cartItems.length > 0 && (
            <Button variant="outline" className="w-full" onClick={clearCart}>
              <Trash2 className="mr-2 h-4 w-4" />
              Kosongkan Keranjang
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
