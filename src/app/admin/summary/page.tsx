'use client';

import { useEffect, useState, useMemo } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { collectionGroup, getDocs, query } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, FileDown, CalendarIcon } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface OrderItem {
  id: string;
  orderId: string;
  name: string;
  quantity: number;
  priceAtOrder: number;
  sku: string;
}

interface Order {
  id: string;
  orderDateTime: string; // ISO string
  items: OrderItem[];
}

const getVendorFromSku = (sku: string) => sku.split('-')[0];

type DailySummary = {
    vendor: string;
    totalOrders: number;
    totalAmount: number;
    items: { name: string, quantity: number }[];
}

export default function AdminSummaryPage() {
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [vendorFilter, setVendorFilter] = useState<string>('all');

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
        }));

        setOrders(ordersWithItems);
      } catch (error) {
        console.error("Error fetching orders:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchOrders();
  }, [firestore, user, isUserLoading]);

  const allVendors = useMemo(() => {
    const vendorSet = new Set(orders.flatMap(o => o.items.map(i => getVendorFromSku(i.sku))));
    return ['all', ...Array.from(vendorSet)];
  }, [orders]);

  const dailySummary: DailySummary[] = useMemo(() => {
    if (!date) return [];
    
    const targetDateOrders = orders.filter(order => new Date(order.orderDateTime).toDateString() === date.toDateString());
    
    const summaryMap: Record<string, { totalOrders: Set<string>; totalAmount: number; items: Record<string, number> }> = {};

    targetDateOrders.forEach(order => {
        order.items.forEach(item => {
            const vendor = getVendorFromSku(item.sku);
            
            // Apply vendor filter
            if (vendorFilter !== 'all' && vendor !== vendorFilter) return;

            if (!summaryMap[vendor]) {
                summaryMap[vendor] = { totalOrders: new Set(), totalAmount: 0, items: {} };
            }
            summaryMap[vendor].totalOrders.add(order.id);
            const itemTotal = item.quantity * item.priceAtOrder;
            summaryMap[vendor].totalAmount += itemTotal;
            summaryMap[vendor].items[item.name] = (summaryMap[vendor].items[item.name] || 0) + item.quantity;
        });
    });

    return Object.entries(summaryMap).map(([vendor, data]) => ({
        vendor,
        totalOrders: data.totalOrders.size,
        totalAmount: data.totalAmount,
        items: Object.entries(data.items).map(([name, quantity]) => ({ name, quantity })),
    }));
  }, [orders, date, vendorFilter]);

  const exportToExcel = () => {
    const dataForExport = dailySummary.map(summary => ({
        'Vendor': summary.vendor,
        'Total Pesanan': summary.totalOrders,
        'Total Pemesanan': summary.totalAmount,
        'Rincian Item': summary.items.map(i => `${i.name} (x${i.quantity})`).join(', '),
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataForExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Rekap Harian");
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const dataBlob = new Blob([excelBuffer], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8'});
    saveAs(dataBlob, `rekap_harian_${date ? date.toISOString().split('T')[0] : 'semua'}.xlsx`);
  };

  if (isLoading || isUserLoading) {
    return <div className="flex h-full items-center justify-center p-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  
  return (
    <div className="space-y-6">
        <Card>
            <CardHeader>
                <CardTitle>Rekap Harian</CardTitle>
                <CardDescription>
                  Rekapitulasi total pesanan per penjual untuk tanggal {date ? format(date, 'eeee, d MMMM yyyy', { locale: id }) : 'semua waktu'}.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-4 items-center mb-4">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant={"outline"} className="w-[280px] justify-start text-left font-normal">
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {date ? format(date, "PPP", { locale: id }) : <span>Pilih tanggal</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                            <Calendar mode="single" selected={date} onSelect={setDate} initialFocus locale={id} />
                        </PopoverContent>
                    </Popover>

                    <Select value={vendorFilter} onValueChange={setVendorFilter}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Pilih Vendor" />
                        </SelectTrigger>
                        <SelectContent>
                            {allVendors.map(v => (
                                <SelectItem key={v} value={v}>
                                    {v === 'all' ? 'Semua Vendor' : v}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Button onClick={exportToExcel} disabled={dailySummary.length === 0}>
                        <FileDown className="mr-2 h-4 w-4" />
                        Export Excel
                    </Button>
                </div>

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Vendor</TableHead>
                            <TableHead className="text-right">Total Pesanan</TableHead>
                            <TableHead className="text-right">Total Pemesanan</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {dailySummary.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center text-muted-foreground py-10">
                                  Tidak ada transaksi ditemukan untuk filter ini.
                                </TableCell>
                            </TableRow>
                        ) : (
                            dailySummary.map(summary => (
                                <TableRow key={summary.vendor}>
                                    <TableCell className="font-medium">{summary.vendor}</TableCell>
                                    <TableCell className="text-right">{summary.totalOrders}</TableCell>
                                    <TableCell className="text-right">{formatPrice(summary.totalAmount)}</TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    </div>
  );
}
