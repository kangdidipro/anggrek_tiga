'use client';

import { useEffect, useState, useMemo } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { collectionGroup, getDocs, query, writeBatch, doc, collection } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, FileDown, CalendarIcon, Trash2 } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
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
  orderDateTime: string; // ISO string
  totalAmount: number;
  status: string;
  deliveryAddress: string;
  paymentMethod: string;
  items: OrderItem[];
}

const getVendorFromSku = (sku: string) => sku.split('-')[0];

export default function AdminOrdersPage() {
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [vendor, setVendor] = useState<string>('all');
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  
  const allVendors = useMemo(() => {
    const vendorSet = new Set(orders.flatMap(o => o.items.map(i => getVendorFromSku(i.sku))));
    return ['all', ...Array.from(vendorSet)];
  }, [orders]);

  useEffect(() => {
    const fetchOrders = async () => {
      if (!firestore || isUserLoading || !user) return;
      
      setIsLoading(true);
      try {
        const ordersQuery = query(collectionGroup(firestore, 'orders'));
        const ordersSnapshot = await getDocs(ordersQuery);
        const ordersData = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Omit<Order, 'items'>));

        const orderItemsQuery = query(collectionGroup(firestore, 'orderItems'));
        const orderItemsSnapshot = await getDocs(orderItemsQuery);
        const orderItemsData = orderItemsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OrderItem));
        
        const ordersWithItems: Order[] = ordersData.map(order => ({
            ...order,
            items: orderItemsData.filter(item => item.orderId === order.id)
        })).sort((a, b) => new Date(b.orderDateTime).getTime() - new Date(a.orderDateTime).getTime());

        setOrders(ordersWithItems);
      } catch (error) {
        console.error("Error fetching orders:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchOrders();
  }, [firestore, user, isUserLoading]);

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
        const orderDate = new Date(order.orderDateTime);
        const dateMatch = date ? orderDate.toDateString() === date.toDateString() : true;
        const vendorMatch = vendor === 'all' ? true : order.items.some(item => getVendorFromSku(item.sku) === vendor);
        return dateMatch && vendorMatch;
    });
  }, [orders, date, vendor]);

  const groupedByVendor = useMemo(() => {
    const groups: Record<string, Order[]> = {};
    filteredOrders.forEach(order => {
        const vendorsInOrder = new Set(order.items.map(item => getVendorFromSku(item.sku)));
        vendorsInOrder.forEach(vendorCode => {
            if (!groups[vendorCode]) {
                groups[vendorCode] = [];
            }
            groups[vendorCode].push(order);
        });
    });
    return groups;
  }, [filteredOrders]);

  const handleDeleteOrder = async () => {
    if (!orderToDelete || !firestore) return;

    setIsDeleting(true);
    try {
        const batch = writeBatch(firestore);

        // Hapus semua item dalam order
        orderToDelete.items.forEach(item => {
            const itemRef = doc(firestore, 'customers', orderToDelete.customerId, 'orders', orderToDelete.id, 'orderItems', item.id);
            batch.delete(itemRef);
        });

        // Hapus dokumen order itu sendiri
        const orderRef = doc(firestore, 'customers', orderToDelete.customerId, 'orders', orderToDelete.id);
        batch.delete(orderRef);

        await batch.commit();

        setOrders(prev => prev.filter(o => o.id !== orderToDelete.id));
        toast({
            title: "Pesanan Dihapus",
            description: "Pesanan telah berhasil dihapus dari sistem.",
        });
    } catch (error) {
        console.error("Error deleting order:", error);
        toast({
            variant: "destructive",
            title: "Gagal Menghapus",
            description: "Terjadi kesalahan saat mencoba menghapus pesanan.",
        });
    } finally {
        setIsDeleting(false);
        setOrderToDelete(null);
    }
  };

  const exportToExcel = () => {
    const dataForExport = filteredOrders.flatMap(order => 
        order.items.map(item => ({
            'Tanggal Order': format(new Date(order.orderDateTime), 'yyyy-MM-dd HH:mm'),
            'Order ID': order.id,
            'Vendor': getVendorFromSku(item.sku),
            'Nama Item': item.name,
            'Jumlah': item.quantity,
            'Harga Satuan': item.priceAtOrder,
            'Total Harga': item.quantity * item.priceAtOrder,
            'Metode Bayar': order.paymentMethod,
            'Alamat': order.deliveryAddress,
        }))
    );

    const worksheet = XLSX.utils.json_to_sheet(dataForExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Orders");
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8'});
    saveAs(data, `orders_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };
  
  if (isLoading || isUserLoading) {
    return <div className="flex h-full items-center justify-center p-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>List Order</CardTitle>
          <CardDescription>Daftar semua pesanan yang masuk.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-4 items-center">
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant={"outline"} className="w-[280px] justify-start text-left font-normal">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {date ? format(date, "PPP") : <span>Pilih tanggal</span>}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                        <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
                    </PopoverContent>
                </Popover>
                 <Select value={vendor} onValueChange={setVendor}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Pilih Vendor" />
                    </SelectTrigger>
                    <SelectContent>
                        {allVendors.map(v => <SelectItem key={v} value={v}>{v === 'all' ? 'Semua Vendor' : v}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Button onClick={exportToExcel} disabled={filteredOrders.length === 0}>
                    <FileDown className="mr-2 h-4 w-4" />
                    Export Excel
                </Button>
            </div>
        </CardContent>
      </Card>
      
      {Object.keys(groupedByVendor).length === 0 ? (
          <p className="text-center text-muted-foreground py-12">Tidak ada order untuk filter yang dipilih.</p>
      ) : (
        Object.entries(groupedByVendor).map(([vendorCode, vendorOrders]) => (
            <div key={vendorCode} className="mb-8">
                <h2 className="text-xl font-bold mb-4 bg-primary/10 p-2 rounded px-4 text-primary">Vendor: {vendorCode}</h2>
                <Accordion type="single" collapsible className="w-full space-y-4">
                  {vendorOrders.map((order) => (
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
                                                  {new Date(order.orderDateTime).toLocaleString('id-ID')}
                                              </CardDescription>
                                          </div>
                                          <div className="text-right flex flex-col items-end gap-1">
                                              <p className="font-semibold text-base md:text-lg text-primary">{formatPrice(order.totalAmount)}</p>
                                               <p className="text-[10px] md:text-xs capitalize text-white font-medium px-2 py-0.5 rounded-full bg-blue-500">{order.status || 'Pending'}</p>
                                          </div>
                                      </div>
                                  </AccordionTrigger>
                          </CardHeader>
                          <AccordionContent>
                                  <CardContent className="p-4 pt-0">
                                      <div className="border-t pt-4">
                                      <h4 className="font-semibold mb-2 text-sm text-muted-foreground uppercase tracking-wider">Item Pesanan:</h4>
                                       <div className="space-y-2 pt-2">
                                          {order.items.filter(item => getVendorFromSku(item.sku) === vendorCode).map(item => (
                                              <div key={item.id} className="flex justify-between text-sm">
                                                  <div>
                                                      <span className="font-medium">{item.name}</span>
                                                      <span className="text-muted-foreground"> x {item.quantity}</span>
                                                  </div>
                                                  <span className="text-muted-foreground">{formatPrice(item.priceAtOrder * item.quantity)}</span>
                                              </div>
                                          ))}
                                      </div>
                                      </div>
                                      <div className="border-t pt-4 mt-4">
                                          <h4 className="font-semibold mb-2 text-sm text-muted-foreground uppercase tracking-wider">Alamat Pengiriman:</h4>
                                          <p className="text-sm text-muted-foreground">{order.deliveryAddress}</p>
                                      </div>
                                      <div className="border-t pt-4 mt-4 flex justify-end">
                                          <Button 
                                              variant="destructive" 
                                              size="sm" 
                                              onClick={() => setOrderToDelete(order)}
                                              disabled={isDeleting}
                                          >
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
        ))
      )}

      <AlertDialog open={!!orderToDelete} onOpenChange={(open) => !open && setOrderToDelete(null)}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle>Apakah Anda yakin?</AlertDialogTitle>
                  <AlertDialogDescription>
                      Tindakan ini tidak dapat dibatalkan. Ini akan menghapus pesanan secara permanen dari database.
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
    </div>
  );
}
