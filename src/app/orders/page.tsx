'use client';

import { useUser, useFirestore, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, query, orderBy, writeBatch, doc, getDocs } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ShoppingBag, Trash2, Clock, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { formatPrice } from '@/lib/utils';
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

interface StatusLog {
    status: string;
    timestamp: string;
}

interface Order {
    id: string;
    customerId: string;
    orderDateTime: string;
    totalAmount: number;
    status: string;
    statusHistory?: StatusLog[];
    deliveryAddress: string;
    items?: OrderItem[];
}

interface OrderItem {
    id: string;
    name: string;
    quantity: number;
    priceAtOrder: number;
}

function OrderItemDetails({ customerId, orderId }: { customerId: string; orderId: string }) {
    const firestore = useFirestore();
    const orderItemsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'customers', customerId, 'orders', orderId, 'orderItems');
    }, [firestore, customerId, orderId]);

    const { data: items, isLoading } = useCollection<OrderItem>(orderItemsQuery);

    if (isLoading) return <p className="text-sm text-muted-foreground">Loading items...</p>;
    if (!items || items.length === 0) return <p className="text-sm text-muted-foreground">No items found for this order.</p>;

    return (
        <div className="space-y-2 pt-2">
            {items.map(item => (
                <div key={item.id} className="flex justify-between text-sm">
                    <div>
                        <span className="font-medium">{item.name}</span>
                        <span className="text-muted-foreground"> x {item.quantity}</span>
                    </div>
                    <span className="text-muted-foreground">{formatPrice(item.priceAtOrder * item.quantity)}</span>
                </div>
            ))}
        </div>
    );
}

export default function OrdersPage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const ordersQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(
            collection(firestore, 'customers', user.uid, 'orders'),
            orderBy('orderDateTime', 'desc')
        );
    }, [user, firestore]);

    const { data: orders, isLoading: areOrdersLoading } = useCollection<Order>(ordersQuery);

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

    const getStatusBadgeColor = (status: string) => {
        const s = status === 'pending' ? 'Dipesan' : (status || 'Dipesan');
        switch (s) {
          case 'Dipesan': return 'bg-yellow-500 hover:bg-yellow-600';
          case 'Diproses': return 'bg-blue-500 hover:bg-blue-600';
          case 'Dikirim': return 'bg-purple-500 hover:bg-purple-600';
          case 'Dibayar': return 'bg-green-600 hover:bg-green-700';
          default: return 'bg-gray-500 hover:bg-gray-600';
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
                    <p className="text-muted-foreground">Berikut adalah daftar semua pesanan Anda.</p>
                </div>
                <div className="space-y-6">
                    <Accordion type="single" collapsible className="w-full space-y-4">
                        {orders.map((order) => (
                            <AccordionItem value={order.id} key={order.id} className="border-b-0">
                            <Card className="shadow-sm">
                                <CardHeader className="p-4">
                                        <AccordionTrigger className="w-full p-0 hover:no-underline">
                                            <div className="flex justify-between items-center w-full">
                                                <div className="text-left">
                                                    <CardTitle className="text-base md:text-lg">
                                                        Order #{order.id.substring(0, 7)}
                                                    </CardTitle>
                                                    <CardDescription className="text-xs md:text-sm">
                                                        {new Date(order.orderDateTime).toLocaleDateString('id-ID', {
                                                            weekday: 'long',
                                                            year: 'numeric',
                                                            month: 'long',
                                                            day: 'numeric'
                                                        })}
                                                    </CardDescription>
                                                </div>
                                                <div className="text-right flex flex-col items-end gap-2">
                                                    <p className="font-semibold text-base md:text-lg text-primary">{formatPrice(order.totalAmount)}</p>
                                                    <Badge className={getStatusBadgeColor(order.status)}>
                                                        {order.status === 'pending' ? 'Dipesan' : (order.status || 'Dipesan')}
                                                    </Badge>
                                                </div>
                                            </div>
                                        </AccordionTrigger>
                                </CardHeader>
                                <AccordionContent>
                                        <CardContent className="p-4 pt-0 space-y-6">
                                            <div className="border-t pt-4">
                                                <h4 className="font-semibold mb-3 text-sm flex items-center gap-2">
                                                    <Clock className="h-4 w-4" /> Status & Riwayat:
                                                </h4>
                                                <div className="bg-muted/30 rounded-lg p-3 space-y-3">
                                                    {order.statusHistory && order.statusHistory.length > 0 ? (
                                                        order.statusHistory.map((log, i) => (
                                                            <div key={i} className="flex items-start gap-3 text-xs">
                                                                <div className="mt-1">
                                                                    <CheckCircle2 className="h-3 w-3 text-primary" />
                                                                </div>
                                                                <div className="flex-1">
                                                                    <span className="font-bold">{log.status}</span>
                                                                    <span className="text-muted-foreground ml-2">
                                                                        {format(new Date(log.timestamp), 'dd MMM yyyy, HH:mm', { locale: id })}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <div className="flex items-start gap-3 text-xs">
                                                            <div className="mt-1">
                                                                <CheckCircle2 className="h-3 w-3 text-primary" />
                                                            </div>
                                                            <div className="flex-1">
                                                                <span className="font-bold">{order.status === 'pending' ? 'Dipesan' : (order.status || 'Dipesan')}</span>
                                                                <span className="text-muted-foreground ml-2">
                                                                    {format(new Date(order.orderDateTime), 'dd MMM yyyy, HH:mm', { locale: id })}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="border-t pt-4">
                                                <h4 className="font-semibold mb-2 text-sm">Detail Item:</h4>
                                                <OrderItemDetails customerId={user.uid} orderId={order.id} />
                                            </div>
                                            <div className="border-t pt-4">
                                                <h4 className="font-semibold mb-2 text-sm">Alamat Pengiriman:</h4>
                                                <p className="text-sm text-muted-foreground">{order.deliveryAddress}</p>
                                            </div>
                                            <div className="border-t pt-4 flex justify-end">
                                                <Button variant="destructive" size="sm" onClick={() => setOrderToDelete(order)}>
                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                    Hapus Pesanan
                                                </Button>
                                            </div>
                                        </CardContent>
                                </AccordionContent>
                            </Card>
                            </AccordionItem>
                        ))}
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
