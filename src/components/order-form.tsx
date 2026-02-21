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
import { Loader2, QrCode, Wallet, Truck } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useUser, useFirestore, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, writeBatch, doc, increment, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import jsPDF from 'jspdf';
import { formatPrice, getVendorFromSku } from '@/lib/utils';
import { format, addDays } from 'date-fns';
import { id } from 'date-fns/locale';
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
  const [mounted, setMounted] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState<Date>(new Date());
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

  useEffect(() => {
    setMounted(true);
    const now = new Date();
    const jakartaHour = parseInt(new Intl.DateTimeFormat('en-GB', {
      hour: 'numeric',
      hour12: false,
      timeZone: 'Asia/Jakarta'
    }).format(now));
    
    const daysToAdd = jakartaHour >= 16 ? 2 : 1;
    setDeliveryDate(addDays(now, daysToAdd));
  }, []);

  const loadImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  };

  const sendEmailReceipt = async (email: string, values: z.infer<typeof formSchema>, orderId: string) => {
    if (!firestore) return;

    try {
      const settingsSnap = await getDoc(doc(firestore, 'settings', 'mail'));
      if (!settingsSnap.exists()) {
        console.warn("SMTP Settings not found in Firestore.");
        return;
      }
      const smtpConfig = settingsSnap.data() as SmtpConfig;

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [80, 350] // Taller for emails too
      });

      const centerPos = 40;
      let y = 10;

      try {
        const qrisImg = await loadImage('/qris.jpeg');
        pdf.addImage(qrisImg, 'JPEG', 25, y, 30, 45);
        y += 50;
      } catch (e) {
        console.warn("Failed to load QRIS image for PDF", e);
      }

      pdf.setFontSize(12);
      pdf.text("TAKJILKU", centerPos, y, { align: 'center' });
      y += 4;
      pdf.setFontSize(8);
      pdf.text("Ramadhan UMKM RW06", centerPos, y, { align: 'center' });
      y += 6;
      pdf.text("-".repeat(40), centerPos, y, { align: 'center' });
      y += 6;
      
      pdf.text(`ID: #${orderId}`, 5, y);
      y += 4;
      pdf.text(`Tgl Order: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 5, y);
      y += 4;
      pdf.setFontSize(8);
      pdf.text(`Tgl Kirim: ${format(deliveryDate, 'eeee, d MMM yyyy', { locale: id })}`, 5, y);
      y += 4;
      pdf.text(`Pemesan: ${values.name}`, 5, y);
      y += 4;
      pdf.text(`Bayar: ${values.paymentMethod}`, 5, y);
      y += 4;
      pdf.text("-".repeat(40), centerPos, y, { align: 'center' });
      y += 6;
      
      const grouped: Record<string, CartItem[]> = {};
      cartItems.forEach(item => {
          const v = item.product.vendor || getVendorFromSku(item.product.sku);
          if (!grouped[v]) grouped[v] = [];
          grouped[v].push(item);
      });

      Object.entries(grouped).forEach(([vendorCode, vendorItems]) => {
          pdf.setFontSize(7);
          pdf.text(`MITRA: ${vendorCode}`, 5, y);
          y += 4;
          pdf.setFontSize(8);
          
          vendorItems.forEach((item) => {
              pdf.text(`${item.product.name}`, 5, y);
              pdf.text(`${item.quantity} x ${formatPrice(item.product.price)}`, 5, y + 4);
              pdf.text(`${formatPrice(item.product.price * item.quantity)}`, 75, y + 4, { align: 'right' });
              y += 10;
          });
          y += 2;
      });
      
      pdf.text("-".repeat(40), centerPos, y, { align: 'center' });
      y += 6;
      pdf.text("Ongkos Antar:", 5, y);
      pdf.text(`${formatPrice(deliveryFee)}`, 75, y, { align: 'right' });
      y += 6;
      
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.text("TOTAL TAGIHAN:", 5, y);
      pdf.text(`${formatPrice(total)}`, 75, y, { align: 'right' });
      pdf.setFont("helvetica", "normal");
      
      y += 10;
      pdf.setFontSize(8);
      pdf.text("Alamat Pengiriman:", 5, y);
      const splitAddress = pdf.splitTextToSize(values.address || "-", 70);
      pdf.text(splitAddress, 5, y + 4);
      
      const pdfBase64 = pdf.output('datauristring');
      const trackingLink = `${window.location.origin}/orders`;

      await sendSmtpEmail(smtpConfig, {
        to: email,
        subject: `Struk Pesanan TakjilKu #${orderId}`,
        text: `Halo ${values.name}, rincian pesanan Anda telah kami terima. Jadwal Kirim: ${format(deliveryDate, 'eeee, d MMMM yyyy', { locale: id })}. Total Bayar: ${formatPrice(total)}. Lacak pesanan Anda di: ${trackingLink}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
            <h2 style="color: #FF8C00; text-align: center;">Konfirmasi Pesanan TakjilKu</h2>
            <p>Halo <strong>${values.name}</strong>,</p>
            <p>Terima kasih telah memesan di TakjilKu! Pesanan Anda telah kami terima dan akan diantar sesuai jadwal berikut:</p>
            <div style="background-color: #fff8e1; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 5px solid #FF8C00;">
              <p style="margin: 0; font-weight: bold; color: #e65100;">Jadwal Pengiriman:</p>
              <p style="margin: 5px 0 0 0; font-size: 18px;">${format(deliveryDate, 'eeee, d MMMM yyyy', { locale: id })}</p>
            </div>
            <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
              <p><strong>ID Pesanan:</strong> #${orderId}</p>
              <p><strong>Total Bayar:</strong> ${formatPrice(total)}</p>
              <p><strong>Metode Pembayaran:</strong> ${values.paymentMethod}</p>
              <p><strong>Alamat Pengiriman:</strong> ${values.address}</p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${trackingLink}" style="background-color: #FF8C00; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Lacak Status Pesanan</a>
            </div>

            <p>Rincian lengkap item pesanan Anda dapat dilihat pada struk PDF yang terlampir.</p>
            <p style="text-align: center; margin-top: 30px; font-size: 12px; color: #888;">&copy; ${new Date().getFullYear()} Tim UMKM RW06 - Anggrek 3</p>
          </div>
        `,
        attachments: [
          {
            filename: `struk_takjilku_${orderId}.pdf`,
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
    
    try {
      const now = new Date();
      const dateStr = format(now, 'yyyyMMdd');
      const timeStr = format(now, 'HHmm');
      const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      
      const orderId = `${dateStr}-TJK-${timeStr}-${randomSuffix}`;

      const batch = writeBatch(firestore);
      const timestamp = now.toISOString();
      
      const jakartaHour = parseInt(new Intl.DateTimeFormat('en-GB', {
        hour: 'numeric',
        hour12: false,
        timeZone: 'Asia/Jakarta'
      }).format(now));
      const isAfterCutoff = jakartaHour >= 16;
      const finalDeliveryDate = addDays(now, isAfterCutoff ? 2 : 1).toISOString();

      const uniqueVendors = Array.from(new Set(cartItems.map(item => item.product.vendor || getVendorFromSku(item.product.sku))));
      const vendorStatuses: Record<string, any> = {};
      uniqueVendors.forEach(v => {
        vendorStatuses[v] = {
          status: 'Dipesan',
          statusHistory: [{ status: 'Dipesan', timestamp: timestamp }]
        };
      });

      const customerRef = doc(firestore, 'customers', user.uid);
      batch.set(customerRef, {
        id: user.uid,
        googleAccountId: user.uid,
        name: values.name,
        email: values.email || '',
        phoneNumber: values.phone,
        deliveryAddress: values.address,
        lastOrderAt: timestamp
      }, { merge: true });

      const orderRef = doc(firestore, 'customers', user.uid, 'orders', orderId);
      const newOrder = {
          id: orderId,
          customerId: user.uid,
          orderDateTime: timestamp,
          deliveryDate: finalDeliveryDate,
          totalAmount: total,
          deliveryFee: deliveryFee,
          paymentMethod: values.paymentMethod,
          vendorStatuses: vendorStatuses,
          deliveryAddress: values.address,
      };
      batch.set(orderRef, newOrder);
      
      cartItems.forEach(item => {
          const orderItemRef = doc(collection(firestore, 'customers', user.uid, 'orders', orderId, 'orderItems'));
          batch.set(orderItemRef, {
              orderId: orderId,
              customerId: user.uid,
              menuItemId: item.product.id,
              quantity: item.quantity,
              priceAtOrder: item.product.price,
              name: item.product.name,
              sku: item.product.sku,
              vendor: item.product.vendor || getVendorFromSku(item.product.sku),
          });

          const menuItemRef = doc(firestore, 'menuItems', item.product.id);
          batch.update(menuItemRef, {
              stock: increment(-item.quantity)
          });
      });

      await batch.commit();

      if (values.email) {
          sendEmailReceipt(values.email, values, orderId);
      }

      toast({
          title: "Pesanan Berhasil 🎉",
          description: "Pesanan Anda telah kami terima dan akan segera diproses.",
      });
      clearCart();
      setSheetOpen(false);
      const searchParams = new URLSearchParams();
      if (values.email) searchParams.set('email', values.email);
      searchParams.set('orderId', orderId);
      router.push(`/order-success?${searchParams.toString()}`);
    } catch (serverError: any) {
        console.error("Submit order error:", serverError);
        toast({
            variant: "destructive",
            title: "Gagal Mengirim Pesanan",
            description: "Terjadi kesalahan hak akses atau jaringan.",
        });
    } finally {
      setIsSubmitting(false);
    }
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
        <div className="p-3 bg-muted/50 rounded-lg border flex items-center gap-3 text-sm">
          <Truck className="h-5 w-5 text-primary shrink-0" />
          <div>
            <p className="font-semibold">Tanggal Antar:</p>
            <p className="text-primary font-bold">
              {mounted ? format(deliveryDate, 'eeee, d MMMM yyyy', { locale: id }) : 'Memuat jadwal...'}
            </p>
          </div>
        </div>

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
