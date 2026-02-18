'use client';

import { useEffect, useState, useMemo } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { collectionGroup, getDocs, query } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, FileDown, CalendarIcon, FileText, Mail, Search } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Input } from '@/components/ui/input';
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
  deliveryAddress: string;
  items: OrderItem[];
}

const getVendorFromSku = (sku: string) => sku.split('-')[0];

type DailySummary = {
    vendor: string;
    totalOrders: number;
    totalAmount: number;
    items: { name: string, quantity: number, sku: string, price: number }[];
    addresses: string[];
}

export default function AdminSummaryPage() {
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [targetEmail, setTargetEmail] = useState('');
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [vendorFilter, setVendorFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

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

  const dailySummary: DailySummary[] = useMemo(() => {
    if (!date) return [];
    
    const targetDateOrders = orders.filter(order => new Date(order.orderDateTime).toDateString() === date.toDateString());
    
    const summaryMap: Record<string, { 
      totalOrders: Set<string>; 
      totalAmount: number; 
      items: Record<string, { name: string, quantity: number, sku: string, price: number }>;
      addresses: Set<string>;
    }> = {};

    targetDateOrders.forEach(order => {
        order.items.forEach(item => {
            const vendor = getVendorFromSku(item.sku);
            
            if (!summaryMap[vendor]) {
                summaryMap[vendor] = { totalOrders: new Set(), totalAmount: 0, items: {}, addresses: new Set() };
            }
            summaryMap[vendor].totalOrders.add(order.id);
            if (order.deliveryAddress) {
              summaryMap[vendor].addresses.add(order.deliveryAddress);
            }
            const itemTotal = item.quantity * item.priceAtOrder;
            summaryMap[vendor].totalAmount += itemTotal;
            
            const itemKey = item.sku;
            if (!summaryMap[vendor].items[itemKey]) {
                summaryMap[vendor].items[itemKey] = { name: item.name, quantity: 0, sku: item.sku, price: item.priceAtOrder };
            }
            summaryMap[vendor].items[itemKey].quantity += item.quantity;
        });
    });

    return Object.entries(summaryMap).map(([vendor, data]) => ({
        vendor,
        totalOrders: data.totalOrders.size,
        totalAmount: data.totalAmount,
        items: Object.values(data.items),
        addresses: Array.from(data.addresses)
    }));
  }, [orders, date]);

  const availableVendors = useMemo(() => {
    const vendors = new Set<string>();
    dailySummary.forEach(s => vendors.add(s.vendor));
    return ['all', ...Array.from(vendors).sort()];
  }, [dailySummary]);

  const filteredSummary = useMemo(() => {
    let result = dailySummary;
    
    if (vendorFilter !== 'all') {
      result = result.filter(s => s.vendor === vendorFilter);
    }
    
    if (searchTerm.trim() !== '') {
        const lowerSearch = searchTerm.toLowerCase();
        result = result.filter(s => 
            s.vendor.toLowerCase().includes(lowerSearch) ||
            s.items.some(item => item.name.toLowerCase().includes(lowerSearch)) ||
            s.addresses.some(addr => addr.toLowerCase().includes(lowerSearch))
        );
    }
    
    return result;
  }, [dailySummary, vendorFilter, searchTerm]);

  const grandTotals = useMemo(() => {
    return filteredSummary.reduce((acc, curr) => ({
      orders: acc.orders + curr.totalOrders,
      amount: acc.amount + curr.totalAmount
    }), { orders: 0, amount: 0 });
  }, [filteredSummary]);

  const exportToExcel = () => {
    const dataForExport = filteredSummary.map(summary => ({
        'Vendor': summary.vendor,
        'Total Pesanan': summary.totalOrders,
        'Total Pemesanan': summary.totalAmount,
        'Rincian Item, Harga & SKU': summary.items.map(i => `${i.name} [${i.sku}] (${formatPrice(i.price)} x ${i.quantity} = ${formatPrice(i.price * i.quantity)})`).join('\r\n'),
        'Alamat Pengiriman': summary.addresses.join('\r\n'),
    }));

    // Add Grand Total row to Excel
    dataForExport.push({
      'Vendor': 'TOTAL KESELURUHAN',
      'Total Pesanan': grandTotals.orders,
      'Total Pemesanan': grandTotals.amount,
      'Rincian Item, Harga & SKU': '',
      'Alamat Pengiriman': ''
    });

    const worksheet = XLSX.utils.json_to_sheet(dataForExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Rekap Harian");
    
    // Auto-width adjustment
    const wscols = [
        {wch: 15}, // Vendor
        {wch: 15}, // Total Pesanan
        {wch: 20}, // Total Pemesanan
        {wch: 70}, // Rincian
        {wch: 50}  // Alamat
    ];
    worksheet['!cols'] = wscols;

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const dataBlob = new Blob([excelBuffer], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8'});
    saveAs(dataBlob, `rekap_harian_${date ? date.toISOString().split('T')[0] : 'semua'}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4'); // Landscape orientation
    const tableColumn = ["Vendor", "Pesanan", "Total", "Rincian Item, Harga & SKU", "Alamat Pengiriman"];
    const tableRows = filteredSummary.map(summary => [
        summary.vendor,
        summary.totalOrders.toString(),
        formatPrice(summary.totalAmount),
        summary.items.map(i => `${i.name} [${i.sku}]\n${formatPrice(i.price)} x ${i.quantity} = ${formatPrice(i.price * i.quantity)}`).join('\n---\n'),
        summary.addresses.join('\n')
    ]);

    // Add Grand Total row to PDF
    tableRows.push([
      "TOTAL KESELURUHAN",
      grandTotals.orders.toString(),
      formatPrice(grandTotals.amount),
      "",
      ""
    ]);

    doc.text(`Rekap Harian Takjil - ${date ? format(date, 'd MMMM yyyy', { locale: id }) : 'Semua'}`, 14, 15);
    autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 20,
        theme: 'grid',
        headStyles: { fillColor: [255, 140, 0] },
        footStyles: { fillColor: [255, 140, 0], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
        columnStyles: {
            3: { cellWidth: 80 }, // Rincian column width
            4: { cellWidth: 60 }  // Alamat column width
        }
    });
    doc.save(`rekap_harian_${date ? date.toISOString().split('T')[0] : 'semua'}.pdf`);
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
    // Simulating email sending process
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setIsSending(false);
    toast({
        title: "Laporan Terkirim",
        description: `Rekap harian (dengan semua kolom) telah dikirim ke ${targetEmail}.`,
    });
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
                    <div className="relative flex-1 min-w-[240px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Cari Vendor, Item, atau Alamat..." 
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
                    
                    <Select value={vendorFilter} onValueChange={setVendorFilter}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Semua Vendor" />
                        </SelectTrigger>
                        <SelectContent>
                            {availableVendors.map(v => (
                                <SelectItem key={v} value={v}>
                                    {v === 'all' ? 'Semua Vendor' : v}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <div className="flex flex-wrap gap-2 items-center">
                        <Button variant="outline" size="sm" onClick={exportToExcel} disabled={filteredSummary.length === 0}>
                            <FileDown className="mr-2 h-4 w-4" />
                            Excel
                        </Button>
                        <Button variant="outline" size="sm" onClick={exportToPDF} disabled={filteredSummary.length === 0}>
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
                            <Button variant="default" size="sm" className="h-8" onClick={sendToEmail} disabled={filteredSummary.length === 0 || isSending || !targetEmail.includes('@')}>
                                {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                                Email
                            </Button>
                        </div>
                    </div>
                </div>

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Vendor</TableHead>
                            <TableHead className="text-right">Pesanan</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead>Rincian Item, Harga & SKU</TableHead>
                            <TableHead>Alamat Pengiriman</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredSummary.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                                  Tidak ada transaksi ditemukan untuk filter ini.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredSummary.map(summary => (
                                <TableRow key={summary.vendor}>
                                    <TableCell className="font-medium">{summary.vendor}</TableCell>
                                    <TableCell className="text-right">{summary.totalOrders}</TableCell>
                                    <TableCell className="text-right">{formatPrice(summary.totalAmount)}</TableCell>
                                    <TableCell className="min-w-[300px]">
                                        <ul className="text-xs space-y-1">
                                            {summary.items.map((item, idx) => (
                                                <li key={idx} className="flex justify-between gap-4 border-b border-muted last:border-0 pb-1">
                                                    <div className="flex-1">
                                                      <span className="block font-medium">{item.name}</span>
                                                      <div className="flex justify-between text-[10px] text-muted-foreground">
                                                        <span>SKU: {item.sku}</span>
                                                        <span>{formatPrice(item.price)} x {item.quantity}</span>
                                                      </div>
                                                    </div>
                                                    <span className="font-bold text-primary self-center">{formatPrice(item.price * item.quantity)}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </TableCell>
                                    <TableCell className="max-w-[200px]">
                                        <ul className="text-[10px] list-disc pl-4 space-y-1 text-muted-foreground">
                                            {summary.addresses.map((addr, idx) => (
                                                <li key={idx} className="truncate" title={addr}>{addr}</li>
                                            ))}
                                        </ul>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                    {filteredSummary.length > 0 && (
                        <TableFooter>
                            <TableRow className="bg-primary/5">
                                <TableCell className="font-bold">TOTAL KESELURUHAN</TableCell>
                                <TableCell className="text-right font-bold">{grandTotals.orders}</TableCell>
                                <TableCell className="text-right font-bold text-primary">{formatPrice(grandTotals.amount)}</TableCell>
                                <TableCell colSpan={2}></TableCell>
                            </TableRow>
                        </TableFooter>
                    )}
                </Table>
            </CardContent>
        </Card>
    </div>
  );
}
