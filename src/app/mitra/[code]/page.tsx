'use client';

import { useEffect, useState, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useUser, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collectionGroup, getDocs, query, collection, where, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CalendarIcon, ShoppingBag, Clock, CheckCircle2, Printer, Calculator, Banknote } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
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
  vendor?: string;
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

const getVendorFromSku = (sku: string) => {
  if (!sku) return 'UNKNOWN';
  if (sku.includes('-')) return sku.split('-')[0];
  const match = sku.match(/^[a-zA-Z]+/);
  return match ? match[0] : sku;
};

const ORDER_STATUSES = ["Dipesan", "Diproses", "Dikirim", "Dibayar"];

export default function MitraOrderPage() {
  const { code } = useParams();
  const firestore = useFirestore();
  const { user, isUserLoading: isAuthLoading } = useUser();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch Mitra Info to verify it exists
  const vendorsQuery = useMemoFirebase(() => {
    if (!firestore || !code) return null;
    return query(collection(firestore, 'vendors'), where('code', '==', code));
  }, [firestore, code]);
  const { data: vendorInfo, isLoading: isVendorLoading } = useCollection<Vendor>(vendorsQuery);

  useEffect(() => {
    const fetchOrders = async () => {
      if (!firestore || !code || isAuthLoading || !user) return;
      
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
        const orderItemsData = orderItemsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OrderItem));
        
        // Filter orders that have items belonging to this mitra
        const ordersWithItems: Order[] = ordersData.map(order => ({
            ...order,
            items: orderItemsData.filter(item => item.orderId === order.id && (item.vendor || getVendorFromSku(item.sku)) === code)
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
  }, [firestore, code, isAuthLoading, user]);

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
        if (!date) return true;
        const orderDate = new Date(order.orderDateTime);
        return orderDate.toDateString() === date.toDateString();
    });
  }, [orders, date]);

  // Financial Summaries
  const financialSummary = useMemo(() => {
    const bruto = filteredOrders.reduce((acc, order) => 
      acc + order.items.reduce((sum, item) => sum + (item.quantity * item.priceAtOrder), 0), 0
    );
    const admin = bruto * 0.05;
    const netto = bruto - admin;
    const totalItems = filteredOrders.reduce((acc, order) => 
      acc + order.items.reduce((sum, item) => sum + item.quantity, 0), 0
    );

    return { bruto, admin, netto, totalItems };
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
    
    const itemsToPrint = order.items;
    const bruto = itemsToPrint.reduce((sum, item) => sum + (item.priceAtOrder * item.quantity), 0);
    const admin = bruto * 0.05;
    const netto = bruto - admin;

    docPdf.setFontSize(12);
    docPdf.text("TAKJILKU", centerPos, y, { align: 'center' });
    y += 4;
    docPdf.setFontSize(8);
    docPdf.text("Ramadhan UMKM RW06", centerPos, y, { align: 'center' });
    y += 4;
    
    docPdf.setFontSize(10);
    docPdf.text(`SLIP MITRA: ${code}`, centerPos, y, { align: 'center' });
    y += 4;
    docPdf.setFontSize(8);
    
    docPdf.text("-".repeat(40), centerPos, y + 4, { align: 'center' });
    y += 10;
    
    docPdf.text(`ID: #${order.id}`, 5, y);
    docPdf.text(`Tgl: ${format(new Date(order.orderDateTime), 'dd/MM/yyyy HH:mm')}`, 5, y + 4);
    docPdf.text(`Bayar: ${order.paymentMethod}`, 5, y + 8);
    docPdf.text("-".repeat(40), centerPos, y + 12, { align: 'center' });
    
    y += 18;
    itemsToPrint.forEach((item) => {
      docPdf.text(`${item.name}`, 5, y);
      docPdf.text(`${item.quantity} x ${formatPrice(item.priceAtOrder)}`, 5, y + 4);
      docPdf.text(`${formatPrice(item.priceAtOrder * item.quantity)}`, 75, y + 4, { align: 'right' });
      y += 10;
    });
    
    docPdf.text("-".repeat(40), centerPos, y, { align: 'center' });
    y += 6;
    
    docPdf.setFontSize(9);
    docPdf.text("SUBTOTAL BRUTO:", 5, y);
    docPdf.text(`${formatPrice(bruto)}`, 75, y, { align: 'right' });
    y += 5;
    docPdf.text("ADMIN (5%):", 5, y);
    docPdf.text(`- ${formatPrice(admin)}`, 75, y, { align: 'right' });
    y += 6;
    
    docPdf.setFontSize(10);
    docPdf.text("NETTO DITERIMA:", 5, y);
    docPdf.text(`${formatPrice(netto)}`, 75, y, { align: 'right' });
    y += 10;
    
    docPdf.setFontSize(8);
    docPdf.text("Alamat Pengiriman:", 5, y);
    const splitAddress = docPdf.splitTextToSize(order.deliveryAddress, 70);
    docPdf.text(splitAddress, 5, y + 4);
    
    y += (splitAddress.length * 4) + 10;
    docPdf.text("Terima Kasih!", centerPos, y, { align: 'center' });
    docPdf.text("Semoga Berkah", centerPos, y + 4, { align: 'center' });
    
    docPdf.save(`slip_mitra_${code}_${order.id.substring(0, 7)}.pdf`);
    
    toast({
      title: "Slip Mitra Berhasil Dibuat",
      description: "File PDF telah diunduh.",
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

  if (isLoading || isVendorLoading || isAuthLoading) {
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
    <div className="container py-8 max-w-5xl mx-auto px-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">Panel Mitra TakjilKu</h1>
          <p className="text-muted-foreground text-lg">{vendor.name} ({vendor.code})</p>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant={"outline"} className="w-full md:w-[240px] justify-start text-left font-normal border-primary/20">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date ? format(date, "PPP", { locale: id }) : <span>Pilih tanggal</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar mode="single" selected={date} onSelect={setDate} initialFocus locale={id} />
          </PopoverContent>
        </Popover>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 text-center">
            <p className="text-xs font-bold text-muted-foreground uppercase mb-1">Pesanan</p>
            <p className="text-2xl font-bold text-primary">{filteredOrders.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 text-center">
            <p className="text-xs font-bold text-muted-foreground uppercase mb-1">Omzet Bruto</p>
            <p className="text-2xl font-bold text-primary">{formatPrice(financialSummary.bruto)}</p>
          </CardContent>
        </Card>
        <Card className="bg-destructive/5 border-destructive/20">
          <CardContent className="p-4 text-center">
            <p className="text-xs font-bold text-destructive/70 uppercase mb-1">Potongan Admin (5%)</p>
            <p className="text-2xl font-bold text-destructive">{formatPrice(financialSummary.admin)}</p>
          </CardContent>
        </Card>
        <Card className="bg-green-500/5 border-green-500/20">
          <CardContent className="p-4 text-center">
            <p className="text-xs font-bold text-green-600 uppercase mb-1">Netto Diterima</p>
            <p className="text-2xl font-bold text-green-600">{formatPrice(financialSummary.netto)}</p>
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
          {filteredOrders.map((order) => {
            const orderBruto = order.items.reduce((sum, item) => sum + (item.quantity * item.priceAtOrder), 0);
            const orderAdmin = orderBruto * 0.05;
            const orderNetto = orderBruto - orderAdmin;

            return (
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
                        <div className="text-right flex flex-col items-end gap-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-muted-foreground font-bold">NETTO:</span>
                            <p className="font-bold text-base md:text-lg text-green-600">
                              {formatPrice(orderNetto)}
                            </p>
                          </div>
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
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                          <div className="flex-1 w-full max-w-xs">
                            <label className="text-xs font-bold text-muted-foreground block mb-2 uppercase tracking-tighter">Ubah Status Pesanan:</label>
                            <Select 
                              disabled={isUpdatingStatus === order.id} 
                              value={order.status === 'pending' ? 'Dipesan' : (order.status || 'Dipesan')} 
                              onValueChange={(val) => handleUpdateStatus(order, val)}
                            >
                              <SelectTrigger className="border-primary/20">
                                <SelectValue placeholder="Ubah Status" />
                              </SelectTrigger>
                              <SelectContent>
                                {ORDER_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button variant="outline" size="sm" onClick={() => handlePrintReceipt(order)} className="shrink-0 border-primary/30">
                            <Printer className="h-4 w-4 mr-2" /> Cetak Slip
                          </Button>
                        </div>
                      </div>

                      <div className="border-t pt-4">
                        <h4 className="font-semibold mb-2 text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                          <Calculator className="h-4 w-4" /> Perhitungan Pembayaran:
                        </h4>
                        <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Omzet Bruto (Penjualan):</span>
                            <span className="font-medium">{formatPrice(orderBruto)}</span>
                          </div>
                          <div className="flex justify-between text-sm text-destructive">
                            <span>Biaya Admin UMKM (5%):</span>
                            <span>- {formatPrice(orderAdmin)}</span>
                          </div>
                          <div className="border-t border-dashed pt-2 flex justify-between font-bold text-green-600">
                            <span className="flex items-center gap-1">
                              <Banknote className="h-4 w-4" /> Bayar ke Mitra (Netto):
                            </span>
                            <span>{formatPrice(orderNetto)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="border-t pt-4">
                        <h4 className="font-semibold mb-2 text-sm text-muted-foreground uppercase tracking-wider">Item Pesanan:</h4>
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
            );
          })}
        </Accordion>
      )}
    </div>
  );
}