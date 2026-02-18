
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collectionGroup, getDocs, query, collection, where } from 'firebase/firestore';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CalendarIcon, ShoppingBag, Clock, CheckCircle2 } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import type { Vendor } from '@/lib/types';

interface StatusLog {
  status: string;
  timestamp: string;
}

interface OrderItem {
  id: string;
  orderId: string;
  customerId: string;
  name: string;
  quantity: number;
  priceAtOrder: number;
  sku: string;
}

interface Order {
  id: string;
  customerId: string;
  orderDateTime: string;
  totalAmount: number;
  status: string;
  statusHistory?: StatusLog[];
  deliveryAddress: string;
  paymentMethod: string;
  items: OrderItem[];
}

const getVendorFromSku = (sku: string) => sku.split('-')[0];

export default function MitraOrderPage() {
  const { code } = useParams();
  const firestore = useFirestore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [date, setDate] = useState<Date | undefined>(new Date());

  // Fetch Mitra Info to verify it exists
  const vendorsQuery = useMemoFirebase(() => {
    if (!firestore || !code) return null;
    return query(collection(firestore, 'vendors'), where('code', '==', code));
  }, [firestore, code]);
  const { data: vendorInfo, isLoading: isVendorLoading } = useCollection<Vendor>(vendorsQuery);

  useEffect(() => {
    const fetchOrders = async () => {
      if (!firestore || !code) return;
      
      setIsLoading(true);
      try {
        const ordersQuery = query(collectionGroup(firestore, 'orders'));
        const ordersSnapshot = await getDocs(ordersQuery);
        const ordersData = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Omit<Order, 'items'>));

        const orderItemsQuery = query(collectionGroup(firestore, 'orderItems'));
        const orderItemsSnapshot = await getDocs(orderItemsQuery);
        const orderItemsData = orderItemsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OrderItem));
        
        // Filter orders that have items belonging to this mitra
        const ordersWithItems: Order[] = ordersData.map(order => ({
            ...order,
            items: orderItemsData.filter(item => item.orderId === order.id && getVendorFromSku(item.sku) === code)
        })).filter(order => order.items.length > 0)
          .sort((a, b) => new Date(b.orderDateTime).getTime() - new Date(a.orderDateTime).getTime());

        setOrders(ordersWithItems);
      } catch (error) {
        console.error("Error fetching orders:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchOrders();
  }, [firestore, code]);

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
        if (!date) return true;
        const orderDate = new Date(order.orderDateTime);
        return orderDate.toDateString() === date.toDateString();
    });
  }, [orders, date]);

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

  if (isLoading || isVendorLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!vendorInfo || vendorInfo.length === 0) {
    return (
      <div className="flex flex-col h-screen items-center justify-center p-4 text-center">
        <h1 className="text-2xl font-bold text-destructive mb-2">Mitra Tidak Ditemukan</h1>
        <p className="text-muted-foreground">Maaf, kode mitra "{code}" tidak terdaftar dalam sistem.</p>
      </div>
    );
  }

  const vendor = vendorInfo[0];

  return (
    <div className="container py-8 max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">Daftar Pesanan Mitra</h1>
          <p className="text-muted-foreground text-lg">{vendor.name} ({vendor.code})</p>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant={"outline"} className="w-[240px] justify-start text-left font-normal border-primary/20">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date ? format(date, "PPP", { locale: id }) : <span>Pilih tanggal</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar mode="single" selected={date} onSelect={setDate} initialFocus locale={id} />
          </PopoverContent>
        </Popover>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 text-center">
            <p className="text-sm font-medium text-muted-foreground uppercase">Total Pesanan</p>
            <p className="text-2xl font-bold text-primary">{filteredOrders.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 text-center">
            <p className="text-sm font-medium text-muted-foreground uppercase">Total Item</p>
            <p className="text-2xl font-bold text-primary">
              {filteredOrders.reduce((acc, order) => acc + order.items.reduce((sum, item) => sum + item.quantity, 0), 0)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 text-center">
            <p className="text-sm font-medium text-muted-foreground uppercase">Total Omzet</p>
            <p className="text-2xl font-bold text-primary">
              {formatPrice(filteredOrders.reduce((acc, order) => acc + order.items.reduce((sum, item) => sum + (item.quantity * item.priceAtOrder), 0), 0))}
            </p>
          </CardContent>
        </Card>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="text-center py-24 bg-muted/20 rounded-xl border border-dashed">
          <ShoppingBag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Tidak ada pesanan untuk tanggal {date ? format(date, 'd MMMM yyyy', { locale: id }) : 'ini'}.</p>
        </div>
      ) : (
        <Accordion type="single" collapsible className="w-full space-y-4">
          {filteredOrders.map((order) => (
            <AccordionItem value={order.id} key={order.id} className="border-b-0">
              <Card className="shadow-sm overflow-hidden border-primary/10">
                <CardHeader className="p-4">
                  <AccordionTrigger className="w-full p-0 hover:no-underline">
                    <div className="flex justify-between items-center w-full">
                      <div className="text-left">
                        <CardTitle className="text-base md:text-lg">
                          Order #{order.id.substring(0, 7)}
                        </CardTitle>
                        <CardDescription className="text-xs md:text-sm">
                          {format(new Date(order.orderDateTime), 'HH:mm')} WIB
                        </CardDescription>
                      </div>
                      <div className="text-right flex flex-col items-end gap-2">
                        <p className="font-semibold text-base md:text-lg text-primary">
                          {formatPrice(order.items.reduce((sum, item) => sum + (item.quantity * item.priceAtOrder), 0))}
                        </p>
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
                      <h4 className="font-semibold mb-2 text-sm text-muted-foreground uppercase tracking-wider">Item Pesanan Anda:</h4>
                      <div className="space-y-2 pt-2">
                        {order.items.map(item => (
                          <div key={item.id} className="flex justify-between text-sm bg-muted/30 p-2 rounded">
                            <div>
                              <span className="font-medium">{item.name}</span>
                              <span className="text-muted-foreground"> x {item.quantity}</span>
                            </div>
                            <span className="font-bold">{formatPrice(item.priceAtOrder * item.quantity)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <h4 className="font-semibold mb-2 text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                        <Clock className="h-4 w-4" /> Riwayat Status:
                      </h4>
                      <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                        {order.statusHistory && order.statusHistory.length > 0 ? (
                          order.statusHistory.map((log, i) => (
                            <div key={i} className="flex items-start gap-3 text-xs">
                              <CheckCircle2 className="h-3 w-3 text-primary mt-0.5" />
                              <div className="flex-1 flex justify-between">
                                <span className="font-bold">{log.status}</span>
                                <span className="text-muted-foreground">
                                  {format(new Date(log.timestamp), 'dd MMM, HH:mm', { locale: id })}
                                </span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="flex items-start gap-3 text-xs">
                            <CheckCircle2 className="h-3 w-3 text-primary mt-0.5" />
                            <div className="flex-1 flex justify-between">
                              <span className="font-bold">{order.status === 'pending' ? 'Dipesan' : (order.status || 'Dipesan')}</span>
                              <span className="text-muted-foreground">
                                {format(new Date(order.orderDateTime), 'dd MMM, HH:mm', { locale: id })}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <h4 className="font-semibold mb-2 text-sm text-muted-foreground uppercase tracking-wider">Alamat Pengiriman:</h4>
                      <p className="text-sm p-3 bg-primary/5 rounded border border-primary/10 italic">
                        {order.deliveryAddress}
                      </p>
                    </div>
                  </CardContent>
                </AccordionContent>
              </Card>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}
