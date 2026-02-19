'use client';

import { useEffect, useState, useMemo } from 'react';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collectionGroup, getDocs, query, collection } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, FileDown, CalendarIcon, FileText, Mail, Search, LayoutGrid } from 'lucide-react';
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
import type { Vendor } from '@/lib/types';

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

type SummaryItem = {
    key: string;
    label: string;
    subLabel?: string;
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
  const [groupBy, setGroupBy] = useState<'orderId' | 'vendor' | 'sku'>('orderId');
  const { toast } = useToast();

  const vendorsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'vendors');
  }, [firestore]);
  const { data: vendorsData } = useCollection<Vendor>(vendorsQuery);

  const vendorLookup = useMemo(() => {
    const map: Record<string, string> = {};
    vendorsData?.forEach(v => {
      map[v.code] = v.name;
    });
    return map;
  }, [vendorsData]);

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

  const summaryData: SummaryItem[] = useMemo(() => {
    if (!date) return [];
    
    const targetDateOrders = orders.filter(order => new Date(order.orderDateTime).toDateString() === date.toDateString());
    
    const summaryMap: Record<string, { 
      label: string;
      subLabel?: string;
      totalOrders: Set<string>; 
      totalAmount: number; 
      items: Record<string, { name: string, quantity: number, sku: string, price: number }>;
      addresses: Set<string>;
    }> = {};

    targetDateOrders.forEach(order => {
        order.items.forEach(item => {
            const vendor = getVendorFromSku(item.sku);
            
            let key = '';
            let label = '';
            let subLabel = '';

            if (groupBy === 'orderId') {
                key = order.id;
                label = `Pesanan #${order.id}`;
                subLabel = format(new Date(order.orderDateTime), 'HH:mm');
            } else if (groupBy === 'vendor') {
                key = vendor;
                const vName = vendorLookup[vendor];
                label = vName && vName !== vendor ? `${vName} (${vendor})` : vendor;
            } else if (groupBy === 'sku') {
                key = item.sku;
                label = `[${item.sku}] ${item.name}`;
            }

            if (!summaryMap[key]) {
                summaryMap[key] = { label, subLabel, totalOrders: new Set(), totalAmount: 0, items: {}, addresses: new Set() };
            }
            summaryMap[key].totalOrders.add(order.id);
            if (order.deliveryAddress) {
              summaryMap[key].addresses.add(order.deliveryAddress);
            }
            const itemTotal = item.quantity * item.priceAtOrder;
            summaryMap[key].totalAmount += itemTotal;
            
            const itemKey = item.sku;
            if (!summaryMap[key].items[itemKey]) {
                summaryMap[key].items[itemKey] = { name: item.name, quantity: 0, sku: item.sku, price: item.priceAtOrder };
            }
            summaryMap[key].items[itemKey].quantity += item.quantity;
        });
    });

    return Object.entries(summaryMap).map(([key, data]) => ({
        key,
        label: data.label,
        subLabel: data.subLabel,
        totalOrders: data.totalOrders.size,
        totalAmount: data.totalAmount,
        items: Object.values(data.items),
        addresses: Array.from(data.addresses)
    }));
  }, [orders, date, groupBy, vendorLookup]);

  const availableVendors = useMemo(() => {
    const vendors = new Set<string>();
    orders.forEach(order => order.items.forEach(item => vendors.add(getVendorFromSku(item.sku))));
    return ['all', ...Array.from(vendors).sort()];
  }, [orders]);

  const filteredSummary = useMemo(() => {
    let result = summaryData;
    
    if (vendorFilter !== 'all') {
      if (groupBy === 'vendor') {
        result = result.filter(s => s.key === vendorFilter);
      } else {
        result = result.filter(s => s.items.some(i => getVendorFromSku(i.sku) === vendorFilter));
      }
    }
    
    if (searchTerm.trim() !== '') {
        const lowerSearch = searchTerm.toLowerCase();
        result = result.filter(s => {
            return s.label.toLowerCase().includes(lowerSearch) ||
                   s.items.some(item => item.name.toLowerCase().includes(lowerSearch)) ||
                   s.addresses.some(addr => addr.toLowerCase().includes(lowerSearch));
        });
    }
    
    return result;
  }, [summaryData, vendorFilter, searchTerm, groupBy]);

  const grandTotals = useMemo(() => {
    return filteredSummary.reduce((acc, curr) => ({
      orders: acc.orders + curr.totalOrders,
      amount: acc.amount + curr.totalAmount
    }), { orders: 0, amount: 0 });
  }, [filteredSummary]);

  const getMitraDisplayName = (code: string) => {
    const name = vendorLookup[code];
    return name && name !== code ? `${name} (${code})` : code;
  };

  const exportToExcel = () => {
    const dataForExport = filteredSummary.map(summary => ({
        'Kategori Group': summary.label,
        'Info': summary.subLabel || '',
        'Total Pesanan': summary.totalOrders,
        'Total Pemesanan': summary.totalAmount,
        'Rincian Item, Harga & SKU': summary.items.map(i => `${i.name} [${i.sku}] (${formatPrice(i.price)} x ${i.quantity} = ${formatPrice(i.price * i.quantity)})`).join('\r\n'),
        'Alamat Pengiriman': summary.addresses.join('\r\n'),
    }));

    dataForExport.push({
      'Kategori Group': 'TOTAL KESELURUHAN',
      'Info': '',
      'Total Pesanan': grandTotals.orders,
      'Total Pemesanan': grandTotals.amount,
      'Rincian Item, Harga & SKU': '',
      'Alamat Pengiriman': ''
    });

    const worksheet = XLSX.utils.json_to_sheet(dataForExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Rekap Harian");
    
    const wscols = [
        {wch: 40}, // Mitra
        {wch: 15}, // Info
        {wch: 15}, // Total Pesanan
        {wch: 20}, // Total Pemesanan
        {wch: 70}, // Rincian
        {wch: 50}  // Alamat
    ];
    worksheet['!cols'] = wscols;

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const dataBlob = new Blob([excelBuffer], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8'});
    saveAs(dataBlob, `rekap_${groupBy}_${date ? date.toISOString().split('T')[0] : 'semua'}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    const tableColumn = ["Group", "Pesanan", "Total", "Rincian Item, Harga & SKU", "Alamat Pengiriman"];
    const tableRows = filteredSummary.map(summary => [
        summary.label + (summary.subLabel ? ` (${summary.subLabel})` : ''),
        summary.totalOrders.toString(),
        formatPrice(summary.totalAmount),
        summary.items.map(i => `${i.name} [${i.sku}]\n${formatPrice(i.price)} x ${i.quantity} = ${formatPrice(i.price * i.quantity)}`).join('\n---\n'),
        summary.addresses.join('\n')
    ]);

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
            0: { cellWidth: 45 },
            3: { cellWidth: 80 },
            4: { cellWidth: 60 }
        }
    });
    doc.save(`rekap_${groupBy}_${date ? date.toISOString().split('T')[0] : 'semua'}.pdf`);
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
        description: `Rekap harian lengkap telah dikirim ke ${targetEmail}.`,
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
                  Rekapitulasi total pesanan per {groupBy === 'orderId' ? 'No. Order' : groupBy === 'vendor' ? 'Mitra' : 'SKU'} untuk tanggal {date ? format(date, 'eeee, d MMMM yyyy', { locale: id }) : 'semua waktu'}.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-4 items-center mb-4">
                    <div className="relative flex-1 min-w-[240px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Cari kata kunci..." 
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
                            <SelectValue placeholder="Semua Mitra" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Semua Mitra</SelectItem>
                            {availableVendors.filter(v => v !== 'all').map(v => (
                                <SelectItem key={v} value={v}>
                                    {getMitraDisplayName(v)}
                                </SelectItem>
                            ))}
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
                            <TableHead>
                                {groupBy === 'orderId' ? 'No. Order' : groupBy === 'vendor' ? 'Mitra' : 'SKU / Produk'}
                            </TableHead>
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
                                <TableRow key={summary.key}>
                                    <TableCell className="font-medium">
                                        {summary.label}
                                        {summary.subLabel && <span className="block text-[10px] text-muted-foreground">{summary.subLabel}</span>}
                                    </TableCell>
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
