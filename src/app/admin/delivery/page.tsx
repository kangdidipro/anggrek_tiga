'use client';

import { useEffect, useState, useMemo } from 'react';
import { useFirestore, useUser, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collectionGroup, getDocs, query, doc, updateDoc, arrayUnion, collection } from 'firebase/firestore';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Truck, Phone, MapPin, User, CheckCircle2, ArrowLeft, Clock, ShoppingBag } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { cn, getVendorFromSku } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface OrderItem {
  id: string;
  orderId: string;
  customerId: string;
  name: string;
  quantity: number;
  sku: string;
  vendor?: string;
}

interface Order {
  id: string;
  customerId: string;
  orderDateTime: string;
  deliveryAddress: string;
  paymentMethod: 'QRIS' | 'COD';
  vendorStatuses?: Record<string, { status: string }>;
  items: OrderItem[];
}

interface Customer {
  id: string;
  name: string;
  phoneNumber: string;
}

export default function AdminDeliveryPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();

  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<string | null>(null);

  // URL Filters
  const filterDate = searchParams.get('date');
  const filterVendor = searchParams.get('vendor') || 'all';
  const filterSearch = searchParams.get('search') || '';

  const customersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'customers');
  }, [firestore]);
  const { data: customersData } = useCollection<Customer>(customersQuery);

  const customerLookup = useMemo(() => {
    const map: Record<string, Customer> = {};
    customersData?.forEach(c => { map[c.id] = c; });
    return map;
  }, [customersData]);

  useEffect(() => {
    const fetchOrders = async () => {
      if (!firestore || isUserLoading || !user) return;
      
      setIsLoading(true);
      try {
        const ordersQuery = query(collectionGroup(firestore, 'orders'));
        const ordersSnapshot = await getDocs(ordersQuery);
        const ordersData = ordersSnapshot.docs.map(doc => {
          const pathParts = doc.ref.path.split('/');
          return { id: doc.id, customerId: pathParts[1], ...doc.data() } as Omit<Order, 'items'>;
        });

        const orderItemsQuery = query(collectionGroup(firestore, 'orderItems'));
        const orderItemsSnapshot = await getDocs(orderItemsQuery);
        const orderItemsData = orderItemsSnapshot.docs.map(doc => {
          const pathParts = doc.ref.path.split('/');
          return { id: doc.id, customerId: pathParts[1], orderId: pathParts[3], ...doc.data() } as OrderItem;
        });
        
        const ordersWithItems: Order[] = ordersData.map(order => ({
            ...order,
            items: orderItemsData.filter(item => item.orderId === order.id && item.customerId === order.customerId)
        })).filter(order => order.items.length > 0);

        setOrders(ordersWithItems);
      } catch (error) {
        console.error("Error fetching delivery orders:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchOrders();
  }, [firestore, user, isUserLoading]);

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      // 1. Date Filter
      if (filterDate) {
        const orderDate = new Date(order.orderDateTime).toDateString();
        const targetDate = new Date(filterDate).toDateString();
        if (orderDate !== targetDate) return false;
      }

      // 2. Vendor Filter
      const uniqueVendorsInOrder = new Set(order.items.map(i => i.vendor || getVendorFromSku(i.sku)));
      if (filterVendor !== 'all' && !uniqueVendorsInOrder.has(filterVendor)) return false;

      // 3. Search Filter
      if (filterSearch) {
        const s = filterSearch.toLowerCase();
        const customer = customerLookup[order.customerId];
        const matches = 
          order.id.toLowerCase().includes(s) ||
          order.deliveryAddress.toLowerCase().includes(s) ||
          customer?.name.toLowerCase().includes(s) ||
          order.items.some(i => i.name.toLowerCase().includes(s));
        if (!matches) return false;
      }

      return true;
    }).sort((a, b) => new Date(b.orderDateTime).getTime() - new Date(a.orderDateTime).getTime());
  }, [orders, filterDate, filterVendor, filterSearch, customerLookup]);

  const handleMarkDelivered = async (order: Order, vendorCode: string) => {
    if (!firestore || isUpdatingStatus) return;
    
    setIsUpdatingStatus(`${order.id}-${vendorCode}`);
    const now = new Date().toISOString();
    
    // Logic: QRIS -> Dikirim, COD -> Dikirim dan Bayar
    const newStatus = order.paymentMethod === 'QRIS' ? 'Dikirim' : 'Dikirim dan Bayar';
    const orderRef = doc(firestore, 'customers', order.customerId, 'orders', order.id);
    
    const updateData = {
      [`vendorStatuses.${vendorCode}.status`]: newStatus,
      [`vendorStatuses.${vendorCode}.statusHistory`]: arrayUnion({ status: newStatus, timestamp: now })
    };

    updateDoc(orderRef, updateData)
      .then(() => {
        setOrders(prev => prev.map(o => {
          if (o.id === order.id) {
            const updatedVendorStatuses = { ...o.vendorStatuses };
            updatedVendorStatuses[vendorCode] = { status: newStatus };
            return { ...o, vendorStatuses: updatedVendorStatuses };
          }
          return o;
        }));
        toast({ title: "Status Diperbarui", description: "Pesanan berhasil ditandai sebagai Terkirim." });
      })
      .catch(error => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: orderRef.path,
          operation: 'update',
          requestResourceData: updateData
        }));
      })
      .finally(() => {
        setIsUpdatingStatus(null);
      });
  };

  const getStatusColor = (status: string) => {
    if (status === 'Dikirim' || status === 'Dikirim dan Bayar') return 'bg-green-600';
    if (status === 'Dibatalkan') return 'bg-destructive';
    return 'bg-blue-500';
  };

  if (isLoading || isUserLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="container py-6 max-w-2xl mx-auto px-4 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard Kurir</h1>
          <p className="text-muted-foreground text-xs uppercase font-bold flex items-center gap-1">
            <Truck className="h-3 w-3" /> {filterDate ? format(new Date(filterDate), 'd MMMM yyyy', { locale: id }) : 'Semua Tanggal'}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-20 bg-muted/20 rounded-xl border border-dashed">
            <ShoppingBag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Tidak ada pesanan untuk dikirim.</p>
          </div>
        ) : (
          filteredOrders.map(order => {
            const customer = customerLookup[order.customerId];
            const vendors = Array.from(new Set(order.items.map(i => i.vendor || getVendorFromSku(i.sku))));
            
            // Only show vendors that match the filter (if filter applied)
            const visibleVendors = filterVendor === 'all' ? vendors : vendors.filter(v => v === filterVendor);

            return (
              <Card key={order.id} className="border-primary/10 shadow-md overflow-hidden">
                <CardHeader className="bg-primary/5 pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-sm font-mono font-bold text-primary">ORDER #{order.id}</CardTitle>
                      <CardDescription className="flex items-center gap-1 text-[10px]">
                        <Clock className="h-3 w-3" /> {format(new Date(order.orderDateTime), 'HH:mm')} WIB
                      </CardDescription>
                    </div>
                    <Badge variant={order.paymentMethod === 'QRIS' ? 'default' : 'destructive'} className="text-[10px] px-2 h-5">
                      {order.paymentMethod}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  {/* Customer Info */}
                  <div className="space-y-3 bg-muted/30 p-3 rounded-lg border">
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-full bg-white flex items-center justify-center border shadow-sm shrink-0">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-sm uppercase">{customer?.name || 'PEMESAN'}</p>
                        <Button variant="link" size="sm" asChild className="h-auto p-0 text-blue-600 font-bold">
                          <a href={`https://wa.me/${customer?.phoneNumber?.replace(/[^0-9]/g, '')}`} target="_blank">
                            <Phone className="h-3 w-3 mr-1" /> {customer?.phoneNumber}
                          </a>
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 text-xs border-t pt-2 border-dashed">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <p className="italic leading-relaxed">{order.deliveryAddress}</p>
                    </div>
                  </div>

                  {/* Sub-Orders per Vendor */}
                  <div className="space-y-4">
                    {visibleVendors.map(vCode => {
                      const vStatus = order.vendorStatuses?.[vCode]?.status || 'Dipesan';
                      const vItems = order.items.filter(i => (i.vendor || getVendorFromSku(i.sku)) === vCode);
                      const isDelivered = vStatus === 'Dikirim' || vStatus === 'Dikirim dan Bayar';

                      return (
                        <div key={vCode} className="border rounded-lg overflow-hidden">
                          <div className="flex justify-between items-center bg-muted/50 px-3 py-1.5 text-[10px] font-bold border-b">
                            <span className="uppercase text-muted-foreground">MITRA: {vCode}</span>
                            <Badge className={cn("text-[9px] h-4 py-0", getStatusColor(vStatus))}>{vStatus}</Badge>
                          </div>
                          <div className="p-3 space-y-2">
                            <ul className="text-xs space-y-1">
                              {vItems.map((item, idx) => (
                                <li key={idx} className="flex justify-between font-medium">
                                  <span>• {item.name}</span>
                                  <span className="bg-primary/10 px-1.5 rounded text-primary font-bold">{item.quantity} Pcs</span>
                                </li>
                              ))}
                            </ul>
                            
                            {!isDelivered && vStatus !== 'Dibatalkan' && (
                              <Button 
                                className="w-full mt-2 h-10 font-bold bg-green-600 hover:bg-green-700 shadow-sm"
                                disabled={isUpdatingStatus === `${order.id}-${vCode}`}
                                onClick={() => handleMarkDelivered(order, vCode)}
                              >
                                {isUpdatingStatus === `${order.id}-${vCode}` ? (
                                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                ) : (
                                  <CheckCircle2 className="h-4 w-4 mr-2" />
                                )}
                                {order.paymentMethod === 'QRIS' ? 'Konfirmasi Terkirim' : 'Kirim & Terima Bayaran'}
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
