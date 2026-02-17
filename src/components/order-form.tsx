'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { submitOrder } from '@/app/actions';
import type { CartItem } from '@/lib/types';
import { useCart } from '@/hooks/use-cart';
import { Loader2, QrCode, Wallet } from 'lucide-react';
import { useState } from 'react';

const formSchema = z.object({
  name: z.string().min(2, { message: 'Nama harus diisi minimal 2 karakter.' }),
  email: z.string().email({ message: 'Format email tidak valid.' }).or(z.literal('')).optional(),
  phone: z.string().min(10, { message: 'Nomor HP/WA harus diisi minimal 10 digit.' }),
  address: z.string().min(10, { message: 'Alamat antar harus diisi minimal 10 karakter.' }),
  paymentMethod: z.enum(['QRIS', 'COD'], { required_error: 'Pilih metode pembayaran.' }),
});

type OrderFormProps = {
    cartItems: CartItem[];
    total: number;
    deliveryFee: number;
    setSheetOpen: (open: boolean) => void;
};

export default function OrderForm({ cartItems, total, deliveryFee, setSheetOpen }: OrderFormProps) {
  const { toast } = useToast();
  const { clearCart } = useCart();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      address: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    const orderPayload = {
      ...values,
      items: cartItems.map(item => ({
        id: item.product.id,
        name: item.product.name,
        sku: item.product.sku,
        quantity: item.quantity,
        price: item.product.price,
      })),
      total,
      deliveryFee,
    };
    
    try {
        await submitOrder(orderPayload);
        toast({
            title: "Pesanan Berhasil 🎉",
            description: "Pesanan Anda telah kami terima dan akan segera diproses.",
        });
        clearCart();
        setSheetOpen(false);
    } catch (error) {
        toast({
            variant: "destructive",
            title: "Gagal Mengirim Pesanan",
            description: "Terjadi kesalahan. Silakan coba lagi.",
        });
    } finally {
        setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nama Pemesan *</FormLabel>
              <FormControl>
                <Input placeholder="Budi Kosasih" {...field} disabled={isSubmitting} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder="anda@email.com" {...field} disabled={isSubmitting} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nomor HP/WA *</FormLabel>
              <FormControl>
                <Input placeholder="081234567890" {...field} disabled={isSubmitting} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Alamat Antar *</FormLabel>
              <FormControl>
                <Textarea placeholder="Jl. Anggrek No. 3, RT 01/RW 06, Kelurahan..." {...field} disabled={isSubmitting} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="paymentMethod"
          render={({ field }) => (
            <FormItem className="space-y-3">
              <FormLabel>Metode Pembayaran *</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  className="flex flex-col space-y-1"
                  disabled={isSubmitting}
                >
                  <FormItem className="flex items-center space-x-3 space-y-0 rounded-md border p-4 has-[:checked]:border-primary">
                    <FormControl>
                      <RadioGroupItem value="QRIS" />
                    </FormControl>
                    <FormLabel className="font-normal flex items-center gap-2">
                      <QrCode className="h-5 w-5" />
                      QRIS (Bayar Sekarang)
                    </FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center space-x-3 space-y-0 rounded-md border p-4 has-[:checked]:border-primary">
                    <FormControl>
                      <RadioGroupItem value="COD" />
                    </FormControl>
                    <FormLabel className="font-normal flex items-center gap-2">
                        <Wallet className="h-5 w-5" />
                      COD (Bayar di Tempat)
                    </FormLabel>
                  </FormItem>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
          {isSubmitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          Kirim Pesanan
        </Button>
      </form>
    </Form>
  );
}
