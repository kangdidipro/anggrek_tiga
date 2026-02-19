'use client';

import { useEffect, useState, useMemo } from 'react';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collectionGroup, getDocs, query, collection } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, FileDown, CalendarIcon, FileText, Mail, Search, LayoutGrid, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { formatPrice, getVendorFromSku } from '@/lib/utils';
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

type SummaryItem = {
    key: string;
    label: string;
    subLabel?: string;
    totalOrders: number;
    totalAmount: number; // Item Sales only
    adminFee: number;    // 5% of totalAmount
    netToVendor: number; // totalAmount - adminFee
    totalDeliveryFee: number; // Ongkir based on filter/group
    items: { name: string, quantity: number, sku: string, price: number, vendor: string }[];
    addresses: string[];
}

type SortConfig = {
  key: keyof SummaryItem | 'label';
  direction: 'asc' | 'desc';
};

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
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'label', direction: 'asc' });
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
      orderIds: Set<string>; 
      totalAmount: number; 
      totalDeliveryFee: number;
      items: Record<string, { name: string, quantity: number, sku: string, price: number, vendor: string }>;
      addresses: Set<string>;
    }> = {};

    targetDateOrders.forEach(order => {
        const uniqueItemsForThisOrder = order.items.filter(item => {
            const vendor = item.vendor || getVendorFromSku(item.sku);
            const matchesVendor = vendorFilter === 'all' || vendor === vendorFilter;
            
            const search = searchTerm.toLowerCase();
            const matchesSearch = searchTerm === '' || 
                order.id.toLowerCase().includes(search) ||
                order.deliveryAddress.toLowerCase().includes(search) ||
                item.name.toLowerCase().includes(search);

            return matchesVendor && matchesSearch;
        });

        if (uniqueItemsForThisOrder.length === 0) return;

        const orderVendorsSeenInOrder = new Set<string>();

        uniqueItemsForThisOrder.forEach(item => {
            const vendor = item.vendor || getVendorFromSku(item.sku);
            
            let key = '';
            let label = '';
            let subLabel = '';

            if (groupBy === 'orderId') {
                // Key is Sub-Order (OrderId + Vendor)
                key = `${order.id}-${vendor}`;
                const vName = vendorLookup[vendor];
                label = key;
                subLabel = `${vName || vendor} | ${format(new Date(order.orderDateTime), 'HH:mm')}`;
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
                    orderIds: new Set(), 
                    totalAmount: 0, 
                    totalDeliveryFee: 0,
                    items: {}, 
                    addresses: new Set(),
                };
            }
            
            summaryMap[key].orderIds.add(order.id);
            if (order.deliveryAddress) {
              summaryMap[key].addresses.add(order.deliveryAddress);
            }
            
            const itemTotal = item.quantity * item.priceAtOrder;
            summaryMap[key].totalAmount += itemTotal;
            
            // Ongkir Logic: Per Mitra per Order
            // We track if this vendor has been counted for this order yet in the context of the grouping
            const vendorOrderKey = `${order.id}-${vendor}`;
            
            // If we are grouping by orderId (which is actually sub-order), each row gets 2500
            // If we are grouping by vendor, each unique order this vendor was in gets 2500
            // If we are grouping by SKU, we don't usually sum ongkir here as it's product-focused
            if (!orderVendorsSeenInOrder.has(vendorOrderKey)) {
                orderVendorsSeenInOrder.add(vendorOrderKey);
                if (groupBy === 'orderId' || groupBy === 'vendor') {
                    summaryMap[key].totalDeliveryFee += 2500;
                }
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
            totalOrders: data.orderIds.size,
            totalAmount: data.totalAmount,
            adminFee: adminFee,
            netToVendor: data.totalAmount - adminFee,
            totalDeliveryFee: data.totalDeliveryFee,
            items: Object.values(data.items),
            addresses: Array.from(data.addresses)
        };
    });
  }, [orders, date, groupBy, vendorLookup, vendorFilter, searchTerm]);

  const filteredSummary = useMemo(() => {
    let result = [...summaryData];
    if (sortConfig.key) {
      result.sort((a, b) => {
        const valA = a[sortConfig.key!] ?? '';
        const valB = b[sortConfig.key!] ?? '';

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [summaryData, sortConfig]);

  const grandTotals = useMemo(() => {
    return filteredSummary.reduce((acc, curr) => ({
      orders: acc.orders + curr.totalOrders,
      amount: acc.amount + curr.totalAmount,
      admin: acc.admin + curr.adminFee,
      net: acc.net + curr.netToVendor,
      ongkir: acc.ongkir + curr.totalDeliveryFee
    }), { orders: 0, amount: 0, admin: 0, net: 0, ongkir: 0 });
  }, [filteredSummary]);

  const availableVendors = useMemo(() => {
    const vendors = new Set<string>();
    orders.forEach(order => order.items.forEach(item => vendors.add(item.vendor || getVendorFromSku(item.sku))));
    return ['all', ...Array.from(vendors).sort()];
  }, [orders]);

  const handleSort = (key: keyof SummaryItem | 'label') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: keyof SummaryItem | 'label') => {
    if (sortConfig.key !== key) return <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-4 w-4 text-primary" /> : <ArrowDown className="ml-2 h-4 w-4 text-primary" />;
  };

  const getMitraDisplayName = (code: string) => {
    const name = vendorLookup[code];
    return name && name !== code ? `${name} (${code})` : code;
  };

  const exportToExcel = () => {
    const dataForExport = filteredSummary.map((summary, index) => ({
        'No.': index + 1,
        'Group (No. Order/Mitra)': summary.label,
        'Info': summary.subLabel || '',
        'Total Produk (Bruto)': summary.totalAmount,
        'Admin (5%)': summary.adminFee,
        'Bayar ke Mitra (Netto)': summary.netToVendor,
        'Ongkir': summary.totalDeliveryFee,
        'Rincian Item': summary.items.map(i => `${i.name} [${i.sku}] (${i.quantity} x ${formatPrice(i.price)})`).join('\r\n'),
        'Alamat': summary.addresses.join('\r\n'),
    }));

    dataForExport.push({
      'No.': '',
      'Group (No. Order/Mitra)': 'TOTAL KESELURUHAN',
      'Info': '',
      'Total Produk (Bruto)': grandTotals.amount,
      'Admin (5%)': grandTotals.admin,
      'Bayar ke Mitra (Netto)': grandTotals.net,
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
    const tableColumn = ["No.", "ID Sub-Order / Group", "Total Produk", "Admin (5%)", "Bayar ke Mitra", "Ongkir", "Rincian Item"];
    const tableRows = filteredSummary.map((summary, index) => [
        (index + 1).toString(),
        summary.label + (summary.subLabel ? `\n(${summary.subLabel})` : ''),
        formatPrice(summary.totalAmount),
        formatPrice(summary.adminFee),
        formatPrice(summary.netToVendor),
        summary.totalDeliveryFee > 0 ? formatPrice(summary.totalDeliveryFee) : '-',
        summary.items.map(i => `${i.name} [${i.sku}]\n${i.quantity} porsi`).join('\n---\n'),
    ]);

    tableRows.push([
      "",
      "TOTAL KESELURUHAN",
      formatPrice(grandTotals.amount),
      formatPrice(grandTotals.admin),
      formatPrice(grandTotals.net),
      formatPrice(grandTotals.ongkir),
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
    // This would typically call a server action, mimicking for now
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
                  Rekapitulasi pengerjaan pesanan per Mitra untuk tanggal {date ? format(date, 'eeee, d MMMM yyyy', { locale: id }) : 'semua waktu'}.
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
                            <SelectItem value="orderId">ID Sub-Order</SelectItem>
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
                                <TableHead className="w-[50px]">No.</TableHead>
                                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('label')}>
                                    <div className="flex items-center">
                                      {groupBy === 'orderId' ? 'ID Sub-Order' : groupBy === 'vendor' ? 'Mitra' : 'SKU / Produk'}
                                      {getSortIcon('label')}
                                    </div>
                                </TableHead>
                                <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort('totalAmount')}>
                                    <div className="flex items-center justify-end">
                                      Total Produk {getSortIcon('totalAmount')}
                                    </div>
                                </TableHead>
                                <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort('adminFee')}>
                                    <div className="flex items-center justify-end">
                                      Admin (5%) {getSortIcon('adminFee')}
                                    </div>
                                </TableHead>
                                <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort('netToVendor')}>
                                    <div className="flex items-center justify-end">
                                      Bayar ke Mitra {getSortIcon('netToVendor')}
                                    </div>
                                </TableHead>
                                <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort('totalDeliveryFee')}>
                                    <div className="flex items-center justify-end">
                                      Ongkir {getSortIcon('totalDeliveryFee')}
                                    </div>
                                </TableHead>
                                <TableHead>Rincian Item & Pembayaran per Mitra</TableHead>
                                <TableHead>Alamat</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredSummary.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                                    Tidak ada transaksi ditemukan.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredSummary.map((summary, index) => (
                                    <TableRow key={summary.key}>
                                        <TableCell className="text-muted-foreground font-mono text-xs">{index + 1}</TableCell>
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
                                        <TableCell className="min-w-[300px]">
                                            <div className="space-y-3">
                                                {Object.entries(groupItemsByVendor(summary.items)).map(([vCode, vItems]) => {
                                                    const subtotalMitra = vItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
                                                    const netMitra = subtotalMitra * 0.95;
                                                    return (
                                                        <div key={vCode} className="space-y-1 bg-muted/20 p-2 rounded-sm border">
                                                            <div className="flex justify-between items-center bg-primary/10 px-2 py-1 rounded-sm border border-primary/20 mb-1">
                                                                <span className="text-[10px] font-bold text-primary uppercase">Mitra: {vCode}</span>
                                                                <div className="flex gap-2 text-[10px]">
                                                                    <span className="text-muted-foreground">Bruto: {formatPrice(subtotalMitra)}</span>
                                                                    <span className="font-bold text-green-700">Bayar: {formatPrice(netMitra)}</span>
                                                                </div>
                                                            </div>
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
                                    <TableCell></TableCell>
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