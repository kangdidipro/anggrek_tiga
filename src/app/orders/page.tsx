'use client';

import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { formatPrice } from '@/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

// Define types for Order and OrderItem based on backend.json
interface Order {
    id: string;
    orderDateTime: string; // ISO string
    totalAmount: number;
    status: string;
    deliveryAddress: string;
    items?: OrderItem[]; // This will be fetched separately
}

interface OrderItem {
    id: string;
    name: string; // Denormalized for display
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

    const ordersQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(
            collection(firestore, 'customers', user.uid, 'orders'),
            orderBy('orderDateTime', 'desc')
        );
    }, [user, firestore]);

    const { data: orders, isLoading: areOrdersLoading } = useCollection<Order>(ordersQuery);
    
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
                <h1 className="text-2xl font-bold mb-2">Lihat Riwayat Pesanan Anda</h1>
                <p className="text-muted-foreground mb-6 max-w-md">
                    Silakan login untuk melihat semua pesanan yang pernah Anda buat.
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
                    Sepertinya Anda belum memesan apa pun. Mari mulai belanja!
                </p>
                <Button asChild>
                    <Link href="/">Kembali ke Menu</Link>
                </Button>
            </div>
        );
    }

    return (
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
                                            <div className="text-right">
                                                <p className="font-semibold text-base md:text-lg text-primary">{formatPrice(order.totalAmount)}</p>
                                                <p className="text-xs capitalize text-white font-medium px-2 py-0.5 rounded-full bg-blue-500">{order.status || 'Pending'}</p>
                                            </div>
                                        </div>
                                    </AccordionTrigger>
                               </CardHeader>
                               <AccordionContent>
                                    <CardContent className="p-4 pt-0">
                                        <div className="border-t pt-4">
                                           <h4 className="font-semibold mb-2 text-sm">Detail Item:</h4>
                                           <OrderItemDetails customerId={user.uid} orderId={order.id} />
                                        </div>
                                        <div className="border-t pt-4 mt-4">
                                            <h4 className="font-semibold mb-2 text-sm">Alamat Pengiriman:</h4>
                                            <p className="text-sm text-muted-foreground">{order.deliveryAddress}</p>
                                        </div>
                                    </CardContent>
                               </AccordionContent>
                           </Card>
                         </AccordionItem>
                    ))}
                </Accordion>
            </div>
        </div>
    );
}
