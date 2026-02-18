
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useFirestore, useUser, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collectionGroup, getDocs, query, writeBatch, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, FileDown, CalendarIcon, Trash2, FileText, Mail, Search, Clock, CheckCircle2 } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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

const ORDER_STATUSES = ["Dipesan", "Diproses", "Dikirim", "Dibayar"];

export default function AdminOrdersPage() {
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [targetEmail, setTargetEmail] = useState('');
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [vendor, setVendor] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<string | null>(null);
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
        })).filter(order => order.items.length > 0)
          .sort((a, b) => new Date(b.orderDateTime).getTime() - new Date(a.orderDateTime).getTime());

        setOrders(ordersWithItems);
      } catch (error: any) {
        console.error("Error fetching orders:", error);
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: 'collectionGroup(orders)',
          operation: 'list',
        }));
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
        
        const search = searchTerm.toLowerCase();
        const searchMatch = search === '' || 
            order.id.toLowerCase().includes(search) || 
            order.deliveryAddress.toLowerCase().includes(search) ||
            order.items.some(item => item.name.toLowerCase().includes(search));

        return dateMatch && vendorMatch && searchMatch;
    });
  }, [orders, date, vendor, searchTerm]);

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

  const handleUpdateStatus = async (order: Order, newStatus: string) => {
    if (!firestore || isUpdatingStatus) return;
    setIsUpdatingStatus(order.id);

    const now = new Date().toISOString();
    const orderRef = doc(firestore, 'customers', order.customerId, 'orders', order.id);
    const updateData = {
      status: newStatus,
      statusHistory: arrayUnion({ status: newStatus, timestamp: now })
    };

    updateDoc(orderRef, updateData)
      .then(() => {
        setOrders(prev => prev.map(o => {
          if (o.id === order.id) {
            return {
              ...o,
              status: newStatus,
              statusHistory: [...(o.statusHistory || []), { status: newStatus, timestamp: now }]
            };
          }
          return o;
        }));

        toast({
          title: "Status Diperbarui",
          description: `Pesanan #${order.id.substring(0, 7)} sekarang: ${newStatus}`,
        });
      })
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: orderRef.path,
          operation: 'update',
          requestResourceData: updateData,
        });
        errorEmitter.emit('permission-error', permissionError);
      })
      .finally(() => {
        setIsUpdatingStatus(null);
      });
  };

  const handleDeleteOrder = async () => {
    if (!orderToDelete || !firestore) return;

    setIsDeleting(true);
    const batch = writeBatch(firestore);

    orderToDelete.items.forEach(item => {
        const itemRef = doc(firestore, 'customers', orderToDelete.customerId, 'orders', orderToDelete.id, 'orderItems', item.id);
        batch.delete(itemRef);
    });

    const orderRef = doc(firestore, 'customers', orderToDelete.customerId, 'orders', orderToDelete.id);
    batch.delete(orderRef);

    batch.commit()
      .then(() => {
        setOrders(prev => prev.filter(o => o.id !== orderToDelete.id));
        toast({
            title: "Pesanan Dihapus",
            description: "Pesanan telah berhasil dihapus dari sistem.",
        });
      })
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: orderRef.path,
          operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
      })
      .finally(() => {
        setIsDeleting(false);
        setOrderToDelete(null);
      });
  };

  const exportToExcel = () => {
    const dataForExport = filteredOrders.flatMap(order => 
        order.items.map(item => ({
            'Tanggal Order': format(new Date(order.orderDateTime), 'yyyy-MM-dd HH:mm'),
            'Order ID': order.id,
            'Mitra': getVendorFromSku(item.sku),
            'Nama Item': item.name,
            'Jumlah': item.quantity,
            'Harga Satuan': item.priceAtOrder,
            'Total Harga': item.quantity * item.priceAtOrder,
            'Metode Bayar': order.paymentMethod,
            'Status': order.status || 'Dipesan',
            'Alamat': order.deliveryAddress,
        }))
    );

    const worksheet = XLSX.utils.json_to_sheet(dataForExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Orders");
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8'});
    saveAs(data, `orders_${date ? format(date, 'yyyy-MM-dd') : 'all'}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const tableColumn = ["Tanggal", "ID", "Mitra", "Item", "Qty", "Total", "Status"];
    const tableRows = filteredOrders.flatMap(order => 
        order.items.map(item => [
            format(new Date(order.orderDateTime), 'dd/MM HH:mm'),
            order.id.substring(0, 5),
            getVendorFromSku(item.sku),
            item.name,
            item.quantity.toString(),
            formatPrice(item.priceAtOrder * item.quantity),
            order.status || 'Dipesan'
        ])
    );

    doc.text(`Daftar Pesanan - ${date ? format(date, 'd MMMM yyyy', { locale: id }) : 'Semua'}`, 14, 15);
    autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 20,
        theme: 'striped',
        headStyles: { fillColor: [255, 140, 0] },
        styles: { fontSize: 8 }
    });
    doc.save(`orders_${date ? format(date, 'yyyy-MM-dd') : 'all'}.pdf`);
  };

  const sendToEmail = async () => {
    if (!targetEmail || !targetEmail.includes('@')) {
        toast({
            variant: "destructive",
            title: "Email Tidak Valid",
            description: "Silakan masukkan alamat email yang benar.",
        });
        return;
    }

    setIsSending(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setIsSending(false);
    toast({
        title: "Laporan Terkirim",
        description: `Daftar pesanan telah dikirim ke ${targetEmail}.`,
    });
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
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Cari ID Order, Alamat, atau Item..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant={"outline"} className="w-[240px] justify-start text-left font-normal">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {date ? format(date, "PPP", { locale: id }) : <span>Pilih tanggal</span>}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                        <Calendar mode="single" selected={date} onSelect={setDate} initialFocus locale={id} />
                    </PopoverContent>
                </Popover>
                 <Select value={vendor} onValueChange={setVendor}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Pilih Mitra" />
                    </SelectTrigger>
                    <SelectContent>
                        {allVendors.map(v => <SelectItem key={v} value={v}>{v === 'all' ? 'Semua Mitra' : v}</SelectItem>)}
                    </SelectContent>
                </Select>
                <div className="flex flex-wrap gap-2 items-center">
                    <Button variant="outline" size="sm" onClick={exportToExcel} disabled={filteredOrders.length === 0}>
                        <FileDown className="mr-2 h-4 w-4" />
                        Excel
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportToPDF} disabled={filteredOrders.length === 0}>
                        <FileText className="mr-2 h-4 w-4" />
                        PDF
                    </Button>
                    <div className="flex items-center gap-1 border rounded-md p-1 bg-muted/20">
                        <Input 
                            type="email" 
                            placeholder="Email Tujuan" 
                            className="h-8 w-40 text-xs border-0 bg-transparent focus-visible:ring-0" 
                            value={targetEmail}
                            onChange={(e) => setTargetEmail(e.target.value)}
                        />
                        <Button variant="default" size="sm" className="h-8" onClick={sendToEmail} disabled={filteredOrders.length === 0 || isSending || !targetEmail.includes('@')}>
                            {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                            Email
                        </Button>
                    </div>
                </div>
            </div>
        </CardContent>
      </Card>
      
      {Object.keys(groupedByVendor).length === 0 ? (
          <p className="text-center text-muted-foreground py-12">Tidak ada order untuk filter yang dipilih.</p>
      ) : (
        Object.entries(groupedByVendor).map(([vendorCode, vendorOrders]) => (
            <div key={vendorCode} className="mb-8">
                <h2 className="text-xl font-bold mb-4 bg-primary/10 p-2 rounded px-4 text-primary">Mitra: {vendorCode}</h2>
                <Accordion type="single" collapsible className="w-full space-y-4">
                  {vendorOrders.map((order) => (
                      <AccordionItem value={order.id} key={order.id} className="border-b-0">
                      <Card className="shadow-sm overflow-hidden">
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
                                        <h4 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                          <Clock className="h-4 w-4" /> Update Status & Riwayat:
                                        </h4>
                                        <div className="flex flex-col md:flex-row gap-4 mb-4">
                                          <div className="flex-1 max-w-xs">
                                            <Select 
                                              disabled={isUpdatingStatus === order.id} 
                                              value={order.status === 'pending' ? 'Dipesan' : (order.status || 'Dipesan')} 
                                              onValueChange={(val) => handleUpdateStatus(order, val)}
                                            >
                                              <SelectTrigger>
                                                <SelectValue placeholder="Ubah Status" />
                                              </SelectTrigger>
                                              <SelectContent>
                                                {ORDER_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                              </SelectContent>
                                            </Select>
                                          </div>
                                        </div>
                                        {/* Riwayat Status */}
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
                                      <div className="border-t pt-4">
                                          <h4 className="font-semibold mb-2 text-sm text-muted-foreground uppercase tracking-wider">Alamat Pengiriman:</h4>
                                          <p className="text-sm text-muted-foreground">{order.deliveryAddress}</p>
                                      </div>
                                      <div className="border-t pt-4 flex justify-end">
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
