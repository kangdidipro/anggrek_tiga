
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import type { CartItem } from '@/lib/types';
import { useCart } from '@/hooks/use-cart';
import { Loader2, QrCode, Wallet } from 'lucide-react';
import { useState } from 'react';
import { useUser, useFirestore, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, writeBatch, doc, increment, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import jsPDF from 'jspdf';
import { formatPrice } from '@/lib/utils';
import { format } from 'date-fns';
import { sendSmtpEmail, type SmtpConfig } from '@/app/actions';

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
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      address: '',
    },
  });

  const paymentMethod = form.watch('paymentMethod');

  const sendEmailReceipt = async (email: string, values: z.infer<typeof formSchema>, orderId: string) => {
    if (!firestore) return;

    try {
      // 1. Fetch SMTP Settings from Firestore (the ones configured in Admin)
      const settingsSnap = await getDoc(doc(firestore, 'settings', 'mail'));
      if (!settingsSnap.exists()) {
        console.warn("SMTP Settings not found in Firestore. Make sure to configure them in Admin Settings.");
        return;
      }
      const smtpConfig = settingsSnap.data() as SmtpConfig;

      // 2. Generate PDF Struk
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [80, 200]
      });

      const centerPos = 40;
      pdf.setFontSize(12);
      pdf.text("TAKJILKU", centerPos, 10, { align: 'center' });
      pdf.setFontSize(8);
      pdf.text("Ramadhan UMKM RW06", centerPos, 14, { align: 'center' });
      pdf.text("-".repeat(40), centerPos, 20, { align: 'center' });
      
      pdf.text(`ID: #${orderId.substring(0, 7)}`, 5, 26);
      pdf.text(`Tgl: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 5, 30);
      pdf.text(`Pemesan: ${values.name}`, 5, 34);
      pdf.text(`Bayar: ${values.paymentMethod}`, 5, 38);
      pdf.text("-".repeat(40), centerPos, 42, { align: 'center' });
      
      let y = 48;
      cartItems.forEach((item) => {
        pdf.text(`${item.product.name}`, 5, y);
        pdf.text(`${item.quantity} x ${formatPrice(item.product.price)}`, 5, y + 4);
        pdf.text(`${formatPrice(item.product.price * item.quantity)}`, 75, y + 4, { align: 'right' });
        y += 10;
      });
      
      pdf.text("-".repeat(40), centerPos, y, { align: 'center' });
      y += 6;
      pdf.text("Ongkir (Delivery):", 5, y);
      pdf.text(`${formatPrice(deliveryFee)}`, 75, y, { align: 'right' });
      y += 6;
      
      pdf.setFontSize(10);
      pdf.text("TOTAL:", 5, y);
      pdf.text(`${formatPrice(total)}`, 75, y, { align: 'right' });
      
      const pdfBase64 = pdf.output('datauristring');

      // 3. Send Real Email via Server Action using configured SMTP
      await sendSmtpEmail(smtpConfig, {
        to: email,
        subject: `Struk Pesanan TakjilKu #${orderId.substring(0, 7)}`,
        text: `Halo ${values.name}, rincian pesanan Anda telah kami terima. Total Bayar: ${formatPrice(total)}.`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
            <h2 style="color: #FF8C00; text-align: center;">Konfirmasi Pesanan TakjilKu</h2>
            <p>Halo <strong>${values.name}</strong>,</p>
            <p>Terima kasih telah memesan di TakjilKu! Pesanan Anda telah kami terima dan sedang diproses.</p>
            <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px;">
              <p><strong>ID Pesanan:</strong> #${orderId.substring(0, 7)}</p>
              <p><strong>Total Bayar:</strong> ${formatPrice(total)}</p>
              <p><strong>Metode Pembayaran:</strong> ${values.paymentMethod}</p>
              <p><strong>Alamat Pengiriman:</strong> ${values.address}</p>
            </div>
            <p>Rincian lengkap item pesanan Anda dapat dilihat pada struk PDF yang terlampir.</p>
            <p style="text-align: center; margin-top: 30px; font-size: 12px; color: #888;">&copy; ${new Date().getFullYear()} Tim UMKM RW06 - Anggrek 3</p>
          </div>
        `,
        attachments: [
          {
            filename: `struk_takjilku_${orderId.substring(0, 7)}.pdf`,
            content: pdfBase64
          }
        ]
      });
    } catch (err) {
      console.error("Error sending order receipt email:", err);
    }
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user || !firestore) {
        toast({
            variant: "destructive",
            title: "Gagal Mengirim Pesanan",
            description: "Tidak dapat terhubung ke layanan. Silakan coba lagi.",
        });
        return;
    }
    setIsSubmitting(true);
    
    const batch = writeBatch(firestore);

    const orderRef = doc(collection(firestore, 'customers', user.uid, 'orders'));
    const now = new Date().toISOString();
    const newOrder = {
        customerId: user.uid,
        orderDateTime: now,
        totalAmount: total,
        deliveryFee: deliveryFee,
        paymentMethod: values.paymentMethod,
        status: 'Dipesan',
        statusHistory: [
          { status: 'Dipesan', timestamp: now }
        ],
        deliveryAddress: values.address,
    };
    batch.set(orderRef, newOrder);
    
    const orderItemsForError: any[] = [];

    cartItems.forEach(item => {
        const orderItemRef = doc(collection(firestore, 'customers', user.uid, 'orders', orderRef.id, 'orderItems'));
        const newOrderItem = {
            orderId: orderRef.id,
            customerId: user.uid,
            menuItemId: item.product.id,
            quantity: item.quantity,
            priceAtOrder: item.product.price,
            name: item.product.name,
            sku: item.product.sku,
        };
        batch.set(orderItemRef, newOrderItem);
        orderItemsForError.push(newOrderItem);

        const menuItemRef = doc(firestore, 'menuItems', item.product.id);
        batch.update(menuItemRef, {
            stock: increment(-item.quantity)
        });
    });

    batch.commit()
      .then(async () => {
        if (values.email) {
            // Trigger the real email sending using SMTP Config
            sendEmailReceipt(values.email, values, orderRef.id);
        }

        toast({
            title: "Pesanan Berhasil 🎉",
            description: "Pesanan Anda telah kami terima dan akan segera diproses.",
        });
        clearCart();
        setSheetOpen(false);
        const searchParams = new URLSearchParams();
        if (values.email) searchParams.set('email', values.email);
        searchParams.set('orderId', orderRef.id);
        router.push(`/order-success?${searchParams.toString()}`);
      })
      .catch((serverError) => {
          const permissionError = new FirestorePermissionError({
            path: `customers/${user.uid}/orders/${orderRef.id}`,
            operation: 'write',
            requestResourceData: { order: newOrder, items: orderItemsForError },
          });
          errorEmitter.emit('permission-error', permissionError);

          toast({
              variant: "destructive",
              title: "Gagal Mengirim Pesanan",
              description: "Terjadi kesalahan hak akses atau jaringan.",
          });
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  }

  if (isUserLoading) {
      return (
        <div className="flex justify-center items-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )
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
              <FormLabel>Email (Untuk Struk Email & PDF)</FormLabel>
              <FormControl>
                <Input placeholder="anda@email.com" {...field} disabled={isSubmitting} />
              </FormControl>
              <FormDescription className="text-[10px]">
                Struk PDF otomatis akan dikirim menggunakan Konfigurasi SMTP sistem.
              </FormDescription>
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
                  
                  {paymentMethod === 'QRIS' && (
                     <div className="p-4 flex flex-col items-center justify-center rounded-md border text-center bg-card">
                        <p className="text-sm font-medium mb-2">Pindai untuk Membayar</p>
                        <img
                            src="/qris.jpeg"
                            alt="QRIS Code"
                            width={250}
                            height={375}
                            className="rounded-md border bg-muted/50"
                        />
                        <p className="mt-2 text-sm text-muted-foreground">UMKM06 - ANGGREK</p>
                     </div>
                  )}

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
        <Button type="submit" className="w-full" size="lg" disabled={isSubmitting || isUserLoading}>
          {isSubmitting || isUserLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          Kirim Pesanan
        </Button>
      </form>
    </Form>
  );
}
