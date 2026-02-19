
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useFirestore, useUser, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collectionGroup, getDocs, query, writeBatch, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, FileDown, CalendarIcon, Trash2, FileText, Mail, Search, Clock, CheckCircle2, Printer, LayoutGrid, Store } from 'lucide-react';
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

interface VendorStatus {
  status: string;
  statusHistory: StatusLog[];
}

interface OrderItem {
  id: string;
  orderId: string;
  customerId: string;
  name: string;
  quantity: number;
  priceAtOrder: number;
  sku: string;
  vendor: string;
}

interface Order {
  id: string;
  customerId: string;
  orderDateTime: string;
  totalAmount: number;
  deliveryFee?: number;
  paymentMethod: 'QRIS' | 'COD';
  vendorStatuses: Record<string, VendorStatus>;
  deliveryAddress: string;
  items: OrderItem[];
}

const getVendorFromSku = (sku: string) => {
  if (!sku) return 'UNKNOWN';
  if (sku.includes('-')) return sku.split('-')[0];
  const match = sku.match(/^[a-zA-Z]+/);
  return match ? match[0] : sku;
};

const STATUS_FLOWS = {
  QRIS: ["Dipesan", "Dibayar", "Diproses", "Dikumpulkan", "Dikirim", "Dibatalkan"],
  COD: ["Dipesan", "Diproses", "Dikumpulkan", "Dikirim dan Bayar", "Dibatalkan"]
};

export default function AdminOrdersPage() {
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [targetEmail, setTargetEmail] = useState('');
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [vendorFilter, setVendorFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [groupBy, setGroupBy] = useState<'orderId' | 'vendor' | 'sku'>('orderId');
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<string | null>(null);
  const { toast } = useToast();
  
  const allVendors = useMemo(() => {
    const vendorSet = new Set(orders.flatMap(o => o.items.map(i => i.vendor)));
    return ['all', ...Array.from(vendorSet)];
  }, [orders]);

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
          return { 
            id: doc.id, 
            customerId: pathParts[1], 
            orderId: pathParts[3], 
            ...doc.data(),
            vendor: doc.data().vendor || getVendorFromSku(doc.data().sku)
          } as OrderItem;
        });
        
        const ordersWithItems: Order[] = ordersData.map(order => ({
            ...order,
            items: orderItemsData.filter(item => item.orderId === order.id && item.customerId === order.customerId)
        })).filter(order => order.items.length > 0)
          .sort((a, b) => new Date(b.orderDateTime).getTime() - new Date(a.orderDateTime).getTime());

        setOrders(ordersWithItems);
      } catch (error: any) {
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
        const vendorMatch = vendorFilter === 'all' ? true : order.items.some(item => item.vendor === vendorFilter);
        
        const search = searchTerm.toLowerCase();
        const searchMatch = search === '' || 
            order.id.toLowerCase().includes(search) || 
            order.deliveryAddress.toLowerCase().includes(search) ||
            order.items.some(item => item.name.toLowerCase().includes(search));

        return dateMatch && vendorMatch && searchMatch;
    });
  }, [orders, date, vendorFilter, searchTerm]);

  const groupedData = useMemo(() => {
    const groups: Record<string, Order[]> = {};
    
    filteredOrders.forEach(order => {
        if (groupBy === 'orderId') {
            groups[order.id] = [order];
        } else if (groupBy === 'vendor') {
            const vendorsInOrder = new Set(order.items.map(item => item.vendor));
            vendorsInOrder.forEach(vendorCode => {
                if (!groups[vendorCode]) groups[vendorCode] = [];
                groups[vendorCode].push(order);
            });
        } else if (groupBy === 'sku') {
            const skusInOrder = new Set(order.items.map(item => item.sku));
            skusInOrder.forEach(sku => {
                const itemName = order.items.find(i => i.sku === sku)?.name || sku;
                const groupKey = `[${sku}] ${itemName}`;
                if (!groups[groupKey]) groups[groupKey] = [];
                groups[groupKey].push(order);
            });
        }
    });
    return groups;
  }, [filteredOrders, groupBy]);

  const groupItemsByVendor = (items: OrderItem[]) => {
    const grouped: Record<string, OrderItem[]> = {};
    items.forEach(item => {
      const v = item.vendor;
      if (!grouped[v]) grouped[v] = [];
      grouped[v].push(item);
    });
    return grouped;
  };

  const handleUpdateVendorStatus = async (order: Order, vendorCode: string, newStatus: string) => {
    if (!firestore || isUpdatingStatus) return;
    setIsUpdatingStatus(`${order.id}-${vendorCode}`);

    const now = new Date().toISOString();
    const orderRef = doc(firestore, 'customers', order.customerId, 'orders', order.id);
    
    const currentVendorStatus = order.vendorStatuses?.[vendorCode] || { status: 'Dipesan', statusHistory: [] };
    const updateData = {
      [`vendorStatuses.${vendorCode}.status`]: newStatus,
      [`vendorStatuses.${vendorCode}.statusHistory`]: arrayUnion({ status: newStatus, timestamp: now })
    };

    updateDoc(orderRef, updateData)
      .then(() => {
        setOrders(prev => prev.map(o => {
          if (o.id === order.id) {
            const updatedVendorStatuses = { ...o.vendorStatuses };
            updatedVendorStatuses[vendorCode] = {
              status: newStatus,
              statusHistory: [...(updatedVendorStatuses[vendorCode]?.statusHistory || []), { status: newStatus, timestamp: now }]
            };
            return { ...o, vendorStatuses: updatedVendorStatuses };
          }
          return o;
        }));

        toast({
          title: "Status Diperbarui",
          description: `Status Mitra ${vendorCode} sekarang: ${newStatus}`,
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
            'Mitra': item.vendor,
            'Nama Item': item.name,
            'Jumlah': item.quantity,
            'Harga Satuan': item.priceAtOrder,
            'Total Harga': item.quantity * item.priceAtOrder,
            'Metode Bayar': order.paymentMethod,
            'Status Mitra': order.vendorStatuses?.[item.vendor]?.status || 'Dipesan',
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
            order.id,
            item.vendor,
            item.name,
            item.quantity.toString(),
            formatPrice(item.priceAtOrder * item.quantity),
            order.vendorStatuses?.[item.vendor]?.status || 'Dipesan'
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

  const loadImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  };

  const handlePrintReceipt = async (order: Order, vendorCode?: string) => {
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
    
    const itemsToPrint = vendorCode 
      ? order.items.filter(item => item.vendor === vendorCode)
      : order.items;
    
    const subtotal = itemsToPrint.reduce((sum, item) => sum + (item.priceAtOrder * item.quantity), 0);
    const totalToPrint = vendorCode ? subtotal : order.totalAmount;

    docPdf.setFontSize(12);
    docPdf.text("TAKJILKU", centerPos, y, { align: 'center' });
    y += 4;
    docPdf.setFontSize(8);
    docPdf.text("Ramadhan UMKM RW06", centerPos, y, { align: 'center' });
    y += 4;
    
    if (vendorCode) {
      docPdf.setFontSize(10);
      docPdf.text(`SLIP MITRA: ${vendorCode}`, centerPos, y, { align: 'center' });
      y += 4;
      docPdf.setFontSize(8);
    }
    
    docPdf.text("-".repeat(40), centerPos, y + 4, { align: 'center' });
    y += 10;
    
    docPdf.text(`ID: #${order.id}`, 5, y);
    docPdf.text(`Tgl: ${format(new Date(order.orderDateTime), 'dd/MM/yyyy HH:mm')}`, 5, y + 4);
    docPdf.text(`Bayar: ${order.paymentMethod}`, 5, y + 8);
    docPdf.text("-".repeat(40), centerPos, y + 12, { align: 'center' });
    
    y += 18;
    if (vendorCode) {
      itemsToPrint.forEach((item) => {
        docPdf.text(`${item.name}`, 5, y);
        docPdf.text(`${item.quantity} x ${formatPrice(item.priceAtOrder)}`, 5, y + 4);
        docPdf.text(`${formatPrice(item.priceAtOrder * item.quantity)}`, 75, y + 4, { align: 'right' });
        y += 10;
      });
    } else {
      const grouped = groupItemsByVendor(itemsToPrint);
      Object.entries(grouped).forEach(([vCode, vItems]) => {
        docPdf.setFontSize(7);
        docPdf.text(`MITRA: ${vCode}`, 5, y);
        y += 4;
        docPdf.setFontSize(8);
        vItems.forEach((item) => {
          docPdf.text(`${item.name}`, 5, y);
          docPdf.text(`${item.quantity} x ${formatPrice(item.priceAtOrder)}`, 5, y + 4);
          docPdf.text(`${formatPrice(item.priceAtOrder * item.quantity)}`, 75, y + 4, { align: 'right' });
          y += 10;
        });
        y += 2;
      });
    }
    
    docPdf.text("-".repeat(40), centerPos, y, { align: 'center' });
    y += 6;
    
    if (!vendorCode) {
      docPdf.text("Ongkir (Delivery):", 5, y);
      docPdf.text(`${formatPrice(order.deliveryFee || 2500)}`, 75, y, { align: 'right' });
      y += 6;
    }
    
    docPdf.setFontSize(10);
    docPdf.text(vendorCode ? "SUBTOTAL MITRA:" : "TOTAL:", 5, y);
    docPdf.text(`${formatPrice(totalToPrint)}`, 75, y, { align: 'right' });
    y += 10;
    
    docPdf.setFontSize(8);
    docPdf.text("Alamat Pengiriman:", 5, y);
    const splitAddress = docPdf.splitTextToSize(order.deliveryAddress, 70);
    docPdf.text(splitAddress, 5, y + 4);
    
    y += (splitAddress.length * 4) + 10;
    docPdf.text("Terima Kasih Telah Memesan!", centerPos, y, { align: 'center' });
    docPdf.text("Semoga Berkah", centerPos, y + 4, { align: 'center' });
    
    docPdf.save(`${vendorCode ? 'slip_mitra' : 'struk'}_${order.id}.pdf`);
    
    toast({
      title: vendorCode ? "Slip Mitra Berhasil Dibuat" : "Struk Berhasil Dibuat",
      description: "File PDF telah diunduh.",
    });
  };

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
                        <Button variant={"outline"} className="w-[200px] justify-start text-left font-normal border-primary/20">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {date ? format(date, "PPP", { locale: id }) : <span>Pilih tanggal</span>}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                        <Calendar mode="single" selected={date} onSelect={setDate} initialFocus locale={id} />
                    </PopoverContent>
                </Popover>
                 <Select value={vendorFilter} onValueChange={setVendorFilter}>
                    <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Semua Mitra" />
                    </SelectTrigger>
                    <SelectContent>
                        {allVendors.map(v => <SelectItem key={v} value={v}>{v === 'all' ? 'Semua Mitra' : v}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Select value={groupBy} onValueChange={(val: any) => setGroupBy(val)}>
                    <SelectTrigger className="w-[180px] border-primary/50 bg-primary/5">
                        <LayoutGrid className="mr-2 h-4 w-4 text-primary" />
                        <SelectValue placeholder="Group By" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="orderId">No. Order</SelectItem>
                        <SelectItem value="vendor">Kode Mitra</SelectItem>
                        <SelectItem value="sku">SKU Produk</SelectItem>
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
                </div>
            </div>
        </CardContent>
      </Card>
      
      {Object.keys(groupedData).length === 0 ? (
          <p className="text-center text-muted-foreground py-12">Tidak ada order untuk filter yang dipilih.</p>
      ) : (
        Object.entries(groupedData).map(([groupKey, groupOrders]) => (
            <div key={groupKey} className="mb-8">
                <h2 className="text-xl font-bold mb-4 bg-primary/10 p-2 rounded px-4 text-primary flex items-center gap-2">
                    {groupBy === 'orderId' ? (
                      <>Order #{groupKey}</>
                    ) : groupBy === 'vendor' ? (
                      <><Store className="h-5 w-5" /> Mitra: {groupKey}</>
                    ) : (
                      <><Store className="h-5 w-5" /> Produk: {groupKey}</>
                    )}
                </h2>
                <Accordion type="single" collapsible className="w-full space-y-4">
                  {groupOrders.map((order) => (
                      <AccordionItem value={order.id} key={order.id} className="border-b-0">
                      <Card className="shadow-sm overflow-hidden">
                          <CardHeader className="p-4">
                                  <AccordionTrigger className="w-full p-0 hover:no-underline">
                                      <div className="flex justify-between items-center w-full">
                                          <div className="text-left">
                                              <CardTitle className="text-base md:text-lg">
                                                  Order #{order.id}
                                              </CardTitle>
                                              <CardDescription className="text-xs md:text-sm">
                                                  {new Date(order.orderDateTime).toLocaleString('id-ID')} | {order.paymentMethod}
                                              </CardDescription>
                                          </div>
                                          <div className="text-right flex flex-col items-end gap-1">
                                              <p className="font-semibold text-base md:text-lg text-primary">
                                                {formatPrice(
                                                  groupBy === 'vendor' ? 
                                                    order.items.filter(item => item.vendor === groupKey).reduce((sum, i) => sum + (i.priceAtOrder * i.quantity), 0) :
                                                  groupBy === 'sku' ?
                                                    order.items.filter(item => item.sku === groupKey.split(']')[0].substring(1)).reduce((sum, i) => sum + (i.priceAtOrder * i.quantity), 0) :
                                                    order.totalAmount
                                                )}
                                              </p>
                                              <span className="text-[10px] text-muted-foreground">Total Order: {formatPrice(order.totalAmount)}</span>
                                          </div>
                                      </div>
                                  </AccordionTrigger>
                          </CardHeader>
                          <AccordionContent>
                                  <CardContent className="p-4 pt-0 space-y-6">
                                      <div className="border-t pt-4">
                                      <h4 className="font-semibold mb-2 text-sm text-muted-foreground uppercase tracking-wider">Status & Item per Mitra:</h4>
                                       <div className="space-y-6 pt-2">
                                          {Object.entries(groupItemsByVendor(
                                              groupBy === 'vendor' ? 
                                                order.items.filter(item => item.vendor === groupKey) :
                                              groupBy === 'sku' ?
                                                order.items.filter(item => item.sku === groupKey.split(']')[0].substring(1)) :
                                                order.items
                                          )).map(([vendorCode, vendorItems]) => {
                                              const subtotalMitra = vendorItems.reduce((sum, i) => sum + (i.priceAtOrder * i.quantity), 0);
                                              const vStatus = order.vendorStatuses?.[vendorCode] || { status: 'Dipesan', statusHistory: [] };
                                              const flow = STATUS_FLOWS[order.paymentMethod];

                                              return (
                                                <div key={vendorCode} className="space-y-3 p-3 border rounded-lg bg-muted/10">
                                                    <div className="flex justify-between items-center bg-primary/10 px-2 py-1 rounded-sm border border-primary/20">
                                                        <span className="text-xs font-bold text-primary uppercase">
                                                            Mitra: {vendorCode}
                                                        </span>
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-xs font-bold text-primary">
                                                                Sub: {formatPrice(subtotalMitra)}
                                                            </span>
                                                            <Badge className={getStatusBadgeColor(vStatus.status)}>
                                                                {vStatus.status}
                                                            </Badge>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-col md:flex-row gap-4 items-start">
                                                        <div className="flex-1 w-full space-y-1.5">
                                                            {vendorItems.map(item => (
                                                                <div key={item.id} className="flex justify-between text-sm border-b border-muted/20 pb-1 last:border-0">
                                                                    <div>
                                                                        <span className="font-medium">{item.name}</span>
                                                                        <span className="text-muted-foreground"> x {item.quantity}</span>
                                                                    </div>
                                                                    <span className="text-muted-foreground">{formatPrice(item.priceAtOrder * item.quantity)}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <div className="w-full md:w-48 space-y-2">
                                                            <span className="text-[10px] font-bold text-muted-foreground block uppercase">Ubah Status Mitra:</span>
                                                            <Select 
                                                                disabled={isUpdatingStatus === `${order.id}-${vendorCode}`} 
                                                                value={vStatus.status} 
                                                                onValueChange={(val) => handleUpdateVendorStatus(order, vendorCode, val)}
                                                            >
                                                                <SelectTrigger className="h-8 text-xs">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {flow.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                                                </SelectContent>
                                                            </Select>
                                                            <Button 
                                                                variant="outline" 
                                                                size="sm" 
                                                                className="w-full h-8 text-[10px]"
                                                                onClick={() => handlePrintReceipt(order, vendorCode)}
                                                            >
                                                                <Printer className="h-3 w-3 mr-1" /> Slip Mitra
                                                            </Button>
                                                        </div>
                                                    </div>

                                                    <div className="mt-2 space-y-1">
                                                        <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                                                            <Clock className="h-3 w-3" /> Riwayat Status:
                                                        </span>
                                                        <div className="bg-muted/30 rounded p-2 text-[10px] space-y-1">
                                                            {vStatus.statusHistory?.map((log, i) => (
                                                                <div key={i} className="flex justify-between">
                                                                    <span className="font-semibold">{log.status}</span>
                                                                    <span className="text-muted-foreground">{format(new Date(log.timestamp), 'dd MMM, HH:mm', { locale: id })}</span>
                                                                </div>
                                                            )) || (
                                                                <div className="flex justify-between">
                                                                    <span className="font-semibold">Dipesan</span>
                                                                    <span className="text-muted-foreground">{format(new Date(order.orderDateTime), 'dd MMM, HH:mm', { locale: id })}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                              );
                                          })}
                                          
                                          {groupBy === 'orderId' && (
                                            <div className="space-y-1 px-3">
                                              <div className="flex justify-between text-sm pt-2 border-t border-dashed">
                                                <span className="text-muted-foreground italic">Ongkir (Delivery)</span>
                                                <span className="text-muted-foreground">{formatPrice(order.deliveryFee || 2500)}</span>
                                              </div>
                                              <div className="flex justify-between text-sm font-bold pt-1">
                                                <span>Total Bayar</span>
                                                <span className="text-primary">{formatPrice(order.totalAmount)}</span>
                                              </div>
                                            </div>
                                          )}
                                      </div>
                                      </div>
                                      <div className="border-t pt-4">
                                          <h4 className="font-semibold mb-2 text-sm text-muted-foreground uppercase tracking-wider">Alamat Pengiriman:</h4>
                                          <p className="text-sm text-muted-foreground">{order.deliveryAddress}</p>
                                      </div>
                                      <div className="border-t pt-4 flex justify-between items-center">
                                          <Button 
                                            variant="outline" 
                                            size="sm" 
                                            onClick={() => handlePrintReceipt(order)}
                                          >
                                            <Printer className="h-4 w-4 mr-2" /> Cetak Struk Full
                                          </Button>
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
                  <AlertDialogCancel onClick={() => !isDeleting && setOrderToDelete(null)} disabled={isDeleting}>
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
