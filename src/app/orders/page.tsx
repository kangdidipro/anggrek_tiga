'use client';

import { useUser, useFirestore, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, query, orderBy, writeBatch, doc, getDocs } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ShoppingBag, Trash2, Clock, CheckCircle2, Printer, Store } from 'lucide-react';
import Link from 'next/link';
import { formatPrice, getVendorFromSku } from '@/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';

interface StatusLog {
    status: string;
    timestamp: string;
}

interface Order {
    id: string;
    customerId: string;
    orderDateTime: string;
    totalAmount: number;
    paymentMethod: 'QRIS' | 'COD';
    vendorStatuses: Record<string, { status: string; statusHistory: StatusLog[] }>;
    deliveryAddress: string;
    deliveryFee?: number;
    items?: OrderItem[];
}

interface OrderItem {
    id: string;
    name: string;
    quantity: number;
    priceAtOrder: number;
    sku: string;
    vendor: string;
}

const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'Dipesan': return 'bg-yellow-500 hover:bg-yellow-600';
      case 'Dibayar': return 'bg-orange-500 hover:bg-orange-600';
      case 'Diproses': return 'bg-blue-500 hover:bg-blue-600';
      case 'Dikumpulkan': return 'bg-purple-500 hover:bg-purple-600';
      case 'Dikirim': 
      case 'Dikirim dan Bayar': return 'bg-green-600 hover:bg-green-700';
      case 'Dibatalkan': return 'bg-destructive hover:bg-destructive/90';
      default: return 'bg-gray-500 hover:bg-gray-600';
    }
};

function OrderItemDetails({ customerId, orderId, vendorStatuses }: { customerId: string; orderId: string; vendorStatuses: Order['vendorStatuses'] }) {
    const firestore = useFirestore();
    const orderItemsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'customers', customerId, 'orders', orderId, 'orderItems');
    }, [firestore, customerId, orderId]);

    const { data: items, isLoading } = useCollection<OrderItem>(orderItemsQuery);

    if (isLoading) return <p className="text-sm text-muted-foreground">Loading items...</p>;
    if (!items || items.length === 0) return <p className="text-sm text-muted-foreground">No items found for this order.</p>;

    const groupItemsByVendor = (items: OrderItem[]) => {
        const grouped: Record<string, OrderItem[]> = {};
        items.forEach(item => {
            const v = item.vendor || getVendorFromSku(item.sku);
            if (!grouped[v]) grouped[v] = [];
            grouped[v].push(item);
        });
        return grouped;
    };

    const grouped = groupItemsByVendor(items);

    return (
        <div className="space-y-6 pt-2">
            {Object.entries(grouped).map(([vendorCode, vendorItems]) => {
                const subtotalMitra = vendorItems.reduce((sum, i) => sum + (i.priceAtOrder * i.quantity), 0);
                const vStatus = vendorStatuses?.[vendorCode] || { status: 'Dipesan', statusHistory: [] };
                
                return (
                    <div key={vendorCode} className="space-y-2 p-3 border rounded-lg bg-muted/5">
                        <div className="flex justify-between items-center bg-primary/5 px-2 py-1 rounded-sm border border-primary/10">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-primary/70 uppercase tracking-tighter">
                                    Mitra: {vendorCode}
                                </span>
                                <Badge className={`${getStatusBadgeColor(vStatus.status)} text-[10px] h-5 py-0 px-2`}>
                                    {vStatus.status}
                                </Badge>
                            </div>
                            <span className="text-[10px] font-bold text-primary">
                                Sub: {formatPrice(subtotalMitra)}
                            </span>
                        </div>
                        <div className="space-y-1.5 pl-2">
                            {vendorItems.map(item => (
                                <div key={item.id} className="flex justify-between text-sm">
                                    <div>
                                        <span className="font-medium">{item.name}</span>
                                        <span className="text-muted-foreground"> x {item.quantity}</span>
                                    </div>
                                    <span className="text-muted-foreground">{formatPrice(item.priceAtOrder * item.quantity)}</span>
                                </div>
                            ))}
                        </div>
                        <div className="mt-2 pt-2 border-t border-dashed">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                                <Clock className="h-3 w-3" /> Update Terakhir: {vStatus.statusHistory?.[vStatus.statusHistory.length - 1]?.timestamp ? format(new Date(vStatus.statusHistory[vStatus.statusHistory.length - 1].timestamp), 'dd MMM, HH:mm', { locale: id }) : '-'}
                            </span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default function OrdersPage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isPrinting, setIsPrinting] = useState<string | null>(null);

    const ordersQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(
            collection(firestore, 'customers', user.uid, 'orders'),
            orderBy('orderDateTime', 'desc')
        );
    }, [user, firestore]);

    const { data: orders, isLoading: areOrdersLoading } = useCollection<Order>(ordersQuery);

    const loadImage = (url: string): Promise<HTMLImageElement> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = url;
        });
    };

    const handlePrintReceipt = async (order: Order) => {
        if (!firestore || !user) return;
        
        setIsPrinting(order.id);
        
        try {
            const itemsQuery = query(collection(firestore, 'customers', user.uid, 'orders', order.id, 'orderItems'));
            const itemsSnap = await getDocs(itemsQuery);
            const items = itemsSnap.docs.map(d => d.data() as OrderItem);

            const docPdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: [80, 250]
            });

            const centerPos = 40;
            let y = 10;

            try {
                const qrisImg = await loadImage('/qris.jpeg');
                docPdf.addImage(qrisImg, 'JPEG', 25, y, 30, 45);
                y += 50;
            } catch (e) {
                console.warn("Failed to load QRIS image for receipt", e);
            }

            docPdf.setFontSize(12);
            docPdf.text("TAKJILKU", centerPos, y, { align: 'center' });
            y += 4;
            docPdf.setFontSize(8);
            docPdf.text("Ramadhan UMKM RW06", centerPos, y, { align: 'center' });
            y += 6;
            docPdf.text("-".repeat(40), centerPos, y, { align: 'center' });
            y += 6;
            
            docPdf.text(`ID: #${order.id}`, 5, y);
            y += 4;
            docPdf.text(`Tgl: ${format(new Date(order.orderDateTime), 'dd/MM/yyyy HH:mm')}`, 5, y);
            y += 4;
            docPdf.text(`Bayar: ${order.paymentMethod}`, 5, y);
            y += 4;
            docPdf.text("-".repeat(40), centerPos, y, { align: 'center' });
            y += 6;
            
            const grouped: Record<string, OrderItem[]> = {};
            items.forEach(item => {
                const v = item.vendor || getVendorFromSku(item.sku);
                if (!grouped[v]) grouped[v] = [];
                grouped[v].push(item);
            });

            Object.entries(grouped).forEach(([vendorCode, vendorItems]) => {
                docPdf.setFontSize(7);
                docPdf.text(`MITRA: ${vendorCode}`, 5, y);
                y += 4;
                docPdf.setFontSize(8);
                
                vendorItems.forEach((item) => {
                    docPdf.text(`${item.name}`, 5, y);
                    docPdf.text(`${item.quantity} x ${formatPrice(item.priceAtOrder)}`, 5, y + 4);
                    docPdf.text(`${formatPrice(item.priceAtOrder * item.quantity)}`, 75, y + 4, { align: 'right' });
                    y += 10;
                });
                y += 2;
            });
            
            docPdf.text("-".repeat(40), centerPos, y, { align: 'center' });
            y += 6;
            const vCount = Object.keys(grouped).length;
            const calculatedDeliveryFee = vCount * 2500;
            docPdf.text(`Ongkir (${vCount} Mitra):`, 5, y);
            docPdf.text(`${formatPrice(calculatedDeliveryFee)}`, 75, y, { align: 'right' });
            y += 6;
            
            docPdf.setFontSize(10);
            docPdf.text("TOTAL BAYAR:", 5, y);
            docPdf.text(`${formatPrice(order.totalAmount)}`, 75, y, { align: 'right' });
            
            y += 10;
            docPdf.setFontSize(8);
            docPdf.text("Alamat Pengiriman:", 5, y);
            const splitAddress = docPdf.splitTextToSize(order.deliveryAddress, 70);
            docPdf.text(splitAddress, 5, y + 4);
            
            y += (splitAddress.length * 4) + 10;
            docPdf.text("Terima Kasih Telah Memesan!", centerPos, y, { align: 'center' });
            docPdf.text("Semoga Berkah", centerPos, y + 4, { align: 'center' });

            docPdf.save(`struk_takjilku_${order.id}.pdf`);
            
            toast({
                title: "Struk Berhasil Diunduh",
                description: "Silakan cek folder download Anda.",
            });
        } catch (error) {
            console.error("Print receipt error:", error);
            toast({
                variant: "destructive",
                title: "Gagal Mencetak Struk",
                description: "Terjadi kesalahan saat memproses PDF.",
            });
        } finally {
            setIsPrinting(null);
        }
    };

    const handleDeleteOrder = async () => {
        if (!orderToDelete || !user || !firestore) return;

        setIsDeleting(true);
        try {
            const batch = writeBatch(firestore);

            const itemsQuery = query(collection(firestore, 'customers', user.uid, 'orders', orderToDelete.id, 'orderItems'));
            const itemsSnapshot = await getDocs(itemsQuery);

            itemsSnapshot.forEach(doc => {
                batch.delete(doc.ref);
            });

            const orderRef = doc(firestore, 'customers', user.uid, 'orders', orderToDelete.id);
            batch.delete(orderRef);

            await batch.commit();

            toast({
                title: "Pesanan Dihapus",
                description: "Pesanan telah berhasil dihapus.",
            });
        } catch (serverError: any) {
            const permissionError = new FirestorePermissionError({
                path: `customers/${user.uid}/orders/${orderToDelete.id}`,
                operation: 'delete',
            });
            errorEmitter.emit('permission-error', permissionError);

            toast({
                variant: "destructive",
                title: "Gagal Menghapus Pesanan",
                description: "Terjadi kesalahan saat menghapus pesanan.",
            });
        } finally {
            setIsDeleting(false);
            setOrderToDelete(null);
        }
    };
    
    if (isUserLoading || (user && areOrdersLoading)) {
        return (
            <div className="container flex items-center justify-center py-24 min-h-[calc(100vh-10rem)]">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
            </div>
        );
    }
    
    if (!user) {
        return (
            <div className="container flex flex-col items-center justify-center text-center py-24 min-h-[calc(100vh-10rem)]">
                <ShoppingBag className="h-16 w-16 text-muted-foreground mb-4" />
                <h1 className="text-2xl font-bold mb-2">Tidak dapat memuat riwayat pesanan.</h1>
                <p className="text-muted-foreground mb-6 max-w-md">
                   Terjadi kesalahan saat memuat data Anda. Silakan kembali ke menu utama dan coba lagi.
                </p>
                <Button asChild>
                    <Link href="/">Kembali ke Menu</Link>
                </Button>
            </div>
        );
    }

    if (!orders || orders.length === 0) {
        return (
             <div className="container flex flex-col items-center justify-center text-center py-24 min-h-[calc(100vh-10rem)]">
                <ShoppingBag className="h-16 w-16 text-muted-foreground mb-4" />
                <h1 className="text-2xl font-bold mb-2">Anda Belum Punya Pesanan</h1>
                <p className="text-muted-foreground mb-6">
                    Sepertinya Anda belum memesan apa pun. Riwayat pesanan Anda akan muncul di sini.
                </p>
                <Button asChild>
                    <Link href="/">Kembali ke Menu</Link>
                </Button>
            </div>
        );
    }

    return (
        <>
            <div className="container py-8 md:py-12">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold tracking-tight font-headline">Riwayat Pesanan Saya</h1>
                    <p className="text-muted-foreground">Berikut adalah daftar pengerjaan pesanan Anda per UMKM.</p>
                </div>
                <div className="space-y-6">
                    <Accordion type="single" collapsible className="w-full space-y-4">
                        {orders.map((order) => {
                            const vCount = Object.keys(order.vendorStatuses || {}).length;
                            const currentOngkir = Math.max(order.deliveryFee || 0, vCount * 2500);
                            const subtotalProduk = order.totalAmount - currentOngkir;

                            return (
                                <AccordionItem value={order.id} key={order.id} className="border-b-0">
                                <Card className="shadow-sm">
                                    <CardHeader className="p-4">
                                            <AccordionTrigger className="w-full p-0 hover:no-underline">
                                                <div className="flex justify-between items-center w-full">
                                                    <div className="text-left">
                                                        <CardTitle className="text-base md:text-lg">
                                                            Order #{order.id}
                                                        </CardTitle>
                                                        <CardDescription className="text-xs md:text-sm">
                                                            {new Date(order.orderDateTime).toLocaleDateString('id-ID', {
                                                                weekday: 'long',
                                                                year: 'numeric',
                                                                month: 'long',
                                                                day: 'numeric'
                                                            })} | {order.paymentMethod}
                                                        </CardDescription>
                                                    </div>
                                                    <div className="text-right flex flex-col items-end gap-2">
                                                        <p className="font-semibold text-base md:text-lg text-primary">{formatPrice(order.totalAmount)}</p>
                                                    </div>
                                                </div>
                                            </AccordionTrigger>
                                    </CardHeader>
                                    <AccordionContent>
                                            <CardContent className="p-4 pt-0 space-y-6">
                                                <div className="border-t pt-4">
                                                    <h4 className="font-semibold mb-3 text-sm flex items-center gap-2">
                                                        <Store className="h-4 w-4" /> Progres Pengerjaan per Mitra:
                                                    </h4>
                                                    <OrderItemDetails customerId={user.uid} orderId={order.id} vendorStatuses={order.vendorStatuses} />
                                                </div>
                                                
                                                <div className="border-t pt-4">
                                                    <h4 className="font-semibold mb-2 text-sm">Rincian Biaya:</h4>
                                                    <div className="space-y-1 bg-muted/5 p-3 rounded-lg border">
                                                        <div className="flex justify-between text-sm">
                                                            <span className="text-muted-foreground">Subtotal Produk</span>
                                                            <span>{formatPrice(subtotalProduk)}</span>
                                                        </div>
                                                        <div className="flex justify-between text-sm">
                                                            <span className="text-muted-foreground italic">
                                                              Ongkos Antar ({vCount} Mitra)
                                                            </span>
                                                            <span>{formatPrice(currentOngkir)}</span>
                                                        </div>
                                                        <div className="flex justify-between font-bold border-t border-dashed pt-1 mt-1">
                                                            <span>Total Bayar</span>
                                                            <span className="text-primary">{formatPrice(order.totalAmount)}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="border-t pt-4">
                                                    <h4 className="font-semibold mb-2 text-sm">Alamat Pengiriman:</h4>
                                                    <p className="text-sm text-muted-foreground italic">{order.deliveryAddress}</p>
                                                </div>
                                                <div className="border-t pt-4 flex justify-end gap-2">
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm" 
                                                        onClick={() => handlePrintReceipt(order)}
                                                        disabled={isPrinting === order.id}
                                                    >
                                                        {isPrinting === order.id ? (
                                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                        ) : (
                                                            <Printer className="h-4 w-4 mr-2" />
                                                        )}
                                                        Cetak Struk
                                                    </Button>
                                                    <Button variant="destructive" size="sm" onClick={() => setOrderToDelete(order)}>
                                                        <Trash2 className="h-4 w-4 mr-2" />
                                                        Hapus Pesanan
                                                    </Button>
                                                </div>
                                            </CardContent>
                                    </AccordionContent>
                                </Card>
                                </AccordionItem>
                            );
                        })}
                    </Accordion>
                </div>
            </div>
            <AlertDialog open={!!orderToDelete} onOpenChange={(open) => !open && setOrderToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Apakah Anda yakin?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tindakan ini tidak dapat dibatalkan. Ini akan menghapus pesanan Anda secara permanen.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setOrderToDelete(null)} disabled={isDeleting}>
                            Batal
                        </AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteOrder} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Hapus
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
