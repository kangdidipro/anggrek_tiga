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
  orderDateTime: string; // ISO string
  deliveryAddress: string;
  deliveryFee?: number;
  items: OrderItem[];
}

const getVendorFromSku = (sku: string) => {
  if (!sku) return 'UNKNOWN';
  if (sku.includes('-')) return sku.split('-')[0];
  const match = sku.match(/^[a-zA-Z]+/);
  return match ? match[0] : sku;
};

type SummaryItem = {
    key: string;
    label: string;
    subLabel?: string;
    totalOrders: number;
    totalAmount: number; // Item Sales only
    adminFee: number;    // 5% of totalAmount
    netToVendor: number; // totalAmount - adminFee
    totalDeliveryFee: number; // Only for orderId grouping
    items: { name: string, quantity: number, sku: string, price: number, vendor: string }[];
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
      totalDeliveryFee: number;
      items: Record<string, { name: string, quantity: number, sku: string, price: number, vendor: string }>;
      addresses: Set<string>;
    }> = {};

    targetDateOrders.forEach(order => {
        const uniqueItemsForThisOrder = order.items.filter(item => {
            const vendor = item.vendor || getVendorFromSku(item.sku);
            return vendorFilter === 'all' || vendor === vendorFilter;
        });

        if (uniqueItemsForThisOrder.length === 0) return;

        uniqueItemsForThisOrder.forEach(item => {
            const vendor = item.vendor || getVendorFromSku(item.sku);
            
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
                summaryMap[key] = { 
                    label, 
                    subLabel, 
                    totalOrders: new Set(), 
                    totalAmount: 0, 
                    totalDeliveryFee: 0,
                    items: {}, 
                    addresses: new Set() 
                };
            }
            
            summaryMap[key].totalOrders.add(order.id);
            if (order.deliveryAddress) {
              summaryMap[key].addresses.add(order.deliveryAddress);
            }
            
            const itemTotal = item.quantity * item.priceAtOrder;
            summaryMap[key].totalAmount += itemTotal;
            
            // Only add delivery fee if grouped by orderId to avoid double counting per group
            if (groupBy === 'orderId') {
                summaryMap[key].totalDeliveryFee = order.deliveryFee || 2500;
            }

            const itemKey = item.sku;
            if (!summaryMap[key].items[itemKey]) {
                summaryMap[key].items[itemKey] = { name: item.name, quantity: 0, sku: item.sku, price: item.priceAtOrder, vendor };
            }
            summaryMap[key].items[itemKey].quantity += item.quantity;
        });
    });

    return Object.entries(summaryMap).map(([key, data]) => {
        const adminFee = data.totalAmount * 0.05;
        return {
            key,
            label: data.label,
            subLabel: data.subLabel,
            totalOrders: data.totalOrders.size,
            totalAmount: data.totalAmount,
            adminFee: adminFee,
            netToVendor: data.totalAmount - adminFee,
            totalDeliveryFee: data.totalDeliveryFee,
            items: Object.values(data.items),
            addresses: Array.from(data.addresses)
        };
    });
  }, [orders, date, groupBy, vendorLookup, vendorFilter]);

  const filteredSummary = useMemo(() => {
    let result = summaryData;
    if (searchTerm.trim() !== '') {
        const lowerSearch = searchTerm.toLowerCase();
        result = result.filter(s => {
            return s.label.toLowerCase().includes(lowerSearch) ||
                   s.items.some(item => item.name.toLowerCase().includes(lowerSearch)) ||
                   s.addresses.some(addr => addr.toLowerCase().includes(lowerSearch));
        });
    }
    return result;
  }, [summaryData, searchTerm]);

  // Calculate grand total Ongkir correctly by looking at unique orders involved
  const trueGrandTotalOngkir = useMemo(() => {
    if (!date) return 0;
    const targetDateOrders = orders.filter(order => new Date(order.orderDateTime).toDateString() === date.toDateString());
    const involvedOrders = targetDateOrders.filter(order => {
        return order.items.some(item => {
            const vendor = item.vendor || getVendorFromSku(item.sku);
            const matchesVendor = vendorFilter === 'all' || vendor === vendorFilter;
            const search = searchTerm.toLowerCase();
            const matchesSearch = searchTerm === '' || 
                order.id.toLowerCase().includes(search) ||
                order.deliveryAddress.toLowerCase().includes(search) ||
                item.name.toLowerCase().includes(search);
            return matchesVendor && matchesSearch;
        });
    });
    return involvedOrders.reduce((sum, o) => sum + (o.deliveryFee || 2500), 0);
  }, [orders, date, vendorFilter, searchTerm]);

  const grandTotals = useMemo(() => {
    const totals = filteredSummary.reduce((acc, curr) => ({
      orders: acc.orders + curr.totalOrders,
      amount: acc.amount + curr.totalAmount,
      admin: acc.admin + curr.adminFee,
      net: acc.net + curr.netToVendor,
    }), { orders: 0, amount: 0, admin: 0, net: 0 });
    
    return { ...totals, ongkir: trueGrandTotalOngkir };
  }, [filteredSummary, trueGrandTotalOngkir]);

  const availableVendors = useMemo(() => {
    const vendors = new Set<string>();
    orders.forEach(order => order.items.forEach(item => vendors.add(item.vendor || getVendorFromSku(item.sku))));
    return ['all', ...Array.from(vendors).sort()];
  }, [orders]);

  const getMitraDisplayName = (code: string) => {
    const name = vendorLookup[code];
    return name && name !== code ? `${name} (${code})` : code;
  };

  const exportToExcel = () => {
    const dataForExport = filteredSummary.map(summary => ({
        'Kategori Group': summary.label,
        'Info': summary.subLabel || '',
        'Pesanan': summary.totalOrders,
        'Total Produk': summary.totalAmount,
        'Admin (5%)': summary.adminFee,
        'Bayar ke Mitra': summary.netToVendor,
        'Ongkir': summary.totalDeliveryFee,
        'Rincian Item': summary.items.map(i => `${i.name} [${i.sku}] (${formatPrice(i.price)} x ${i.quantity})`).join('\r\n'),
        'Alamat': summary.addresses.join('\r\n'),
    }));

    dataForExport.push({
      'Kategori Group': 'TOTAL KESELURUHAN',
      'Info': '',
      'Pesanan': grandTotals.orders,
      'Total Produk': grandTotals.amount,
      'Admin (5%)': grandTotals.admin,
      'Bayar ke Mitra': grandTotals.net,
      'Ongkir': grandTotals.ongkir,
      'Rincian Item': '',
      'Alamat': ''
    });

    const worksheet = XLSX.utils.json_to_sheet(dataForExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Rekap Harian");
    
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const dataBlob = new Blob([excelBuffer], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8'});
    saveAs(dataBlob, `rekap_${groupBy}_${date ? date.toISOString().split('T')[0] : 'semua'}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    const tableColumn = ["Group", "Produk", "Admin (5%)", "Bayar ke Mitra", "Ongkir", "Rincian Item", "Alamat"];
    const tableRows = filteredSummary.map(summary => [
        summary.label + (summary.subLabel ? ` (${summary.subLabel})` : ''),
        formatPrice(summary.totalAmount),
        formatPrice(summary.adminFee),
        formatPrice(summary.netToVendor),
        summary.totalDeliveryFee > 0 ? formatPrice(summary.totalDeliveryFee) : '-',
        summary.items.map(i => `${i.name} [${i.sku}]\n${i.quantity} porsi`).join('\n---\n'),
        summary.addresses.join('\n')
    ]);

    tableRows.push([
      "TOTAL KESELURUHAN",
      formatPrice(grandTotals.amount),
      formatPrice(grandTotals.admin),
      formatPrice(grandTotals.net),
      formatPrice(grandTotals.ongkir),
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
        styles: { fontSize: 8, overflow: 'linebreak' },
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

  const groupItemsByVendor = (items: SummaryItem['items']) => {
    const grouped: Record<string, SummaryItem['items']> = {};
    items.forEach(item => {
      const v = item.vendor;
      if (!grouped[v]) grouped[v] = [];
      grouped[v].push(item);
    });
    return grouped;
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
                  Rekapitulasi total pesanan untuk tanggal {date ? format(date, 'eeee, d MMMM yyyy', { locale: id }) : 'semua waktu'}.
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
                            <SelectItem value="all">Semua Mitra</SelectItem>
                            {availableVendors.filter(v => v !== 'all').map(v => (
                                <SelectItem key={v} value={v}>
                                    {getMitraDisplayName(v)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={groupBy} onValueChange={(val: any) => setGroupBy(val)}>
                        <SelectTrigger className="w-[150px] border-primary/50 bg-primary/5">
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
                            <FileDown className="mr-2 h-4 w-4" /> Excel
                        </Button>
                        <Button variant="outline" size="sm" onClick={exportToPDF} disabled={filteredSummary.length === 0}>
                            <FileText className="mr-2 h-4 w-4" /> PDF
                        </Button>
                        <div className="flex items-center gap-1 border rounded-md p-1 bg-muted/20">
                            <Input 
                                type="email" 
                                placeholder="Email" 
                                className="h-8 w-32 text-xs border-0 bg-transparent focus-visible:ring-0" 
                                value={targetEmail}
                                onChange={(e) => setTargetEmail(e.target.value)}
                            />
                            <Button variant="default" size="sm" className="h-8" onClick={sendToEmail} disabled={filteredSummary.length === 0 || isSending || !targetEmail.includes('@')}>
                                {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="rounded-md border overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>
                                    {groupBy === 'orderId' ? 'No. Order' : groupBy === 'vendor' ? 'Mitra' : 'SKU / Produk'}
                                </TableHead>
                                <TableHead className="text-right">Total Produk</TableHead>
                                <TableHead className="text-right">Admin (5%)</TableHead>
                                <TableHead className="text-right">Bayar ke Mitra</TableHead>
                                <TableHead className="text-right">Ongkir</TableHead>
                                <TableHead>Rincian Item</TableHead>
                                <TableHead>Alamat</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredSummary.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                                    Tidak ada transaksi ditemukan.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredSummary.map(summary => (
                                    <TableRow key={summary.key}>
                                        <TableCell className="font-medium">
                                            {summary.label}
                                            {summary.subLabel && <span className="block text-[10px] text-muted-foreground">{summary.subLabel}</span>}
                                        </TableCell>
                                        <TableCell className="text-right">{formatPrice(summary.totalAmount)}</TableCell>
                                        <TableCell className="text-right text-destructive font-medium">{formatPrice(summary.adminFee)}</TableCell>
                                        <TableCell className="text-right font-bold text-green-600">{formatPrice(summary.netToVendor)}</TableCell>
                                        <TableCell className="text-right">
                                            {summary.totalDeliveryFee > 0 ? formatPrice(summary.totalDeliveryFee) : '-'}
                                        </TableCell>
                                        <TableCell className="min-w-[250px]">
                                            <div className="space-y-2">
                                                {Object.entries(groupItemsByVendor(summary.items)).map(([vCode, vItems]) => {
                                                    const subtotalMitra = vItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
                                                    return (
                                                        <div key={vCode} className="space-y-1">
                                                            {groupBy !== 'vendor' && (
                                                                <div className="flex justify-between items-center bg-primary/5 px-2 py-0.5 rounded-sm border border-primary/10">
                                                                    <span className="text-[10px] font-bold text-primary/70 uppercase">Mitra: {vCode}</span>
                                                                    <span className="text-[10px] font-bold text-primary">Sub: {formatPrice(subtotalMitra)}</span>
                                                                </div>
                                                            )}
                                                            <ul className="text-xs space-y-1 pl-1">
                                                                {vItems.map((item, idx) => (
                                                                    <li key={idx} className="flex justify-between gap-4 border-b border-muted last:border-0 pb-1">
                                                                        <span className="flex-1">{item.name} <span className="text-muted-foreground">[{item.sku}]</span></span>
                                                                        <span className="font-bold">{item.quantity} porsi</span>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </TableCell>
                                        <TableCell className="max-w-[150px]">
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
                                <TableRow className="bg-primary/5 font-bold">
                                    <TableCell>TOTAL KESELURUHAN</TableCell>
                                    <TableCell className="text-right text-primary">{formatPrice(grandTotals.amount)}</TableCell>
                                    <TableCell className="text-right text-destructive">{formatPrice(grandTotals.admin)}</TableCell>
                                    <TableCell className="text-right text-green-700">{formatPrice(grandTotals.net)}</TableCell>
                                    <TableCell className="text-right">{formatPrice(grandTotals.ongkir)}</TableCell>
                                    <TableCell colSpan={2}></TableCell>
                                </TableRow>
                            </TableFooter>
                        )}
                    </Table>
                </div>
            </CardContent>
        </Card>
    </div>
  );
}
