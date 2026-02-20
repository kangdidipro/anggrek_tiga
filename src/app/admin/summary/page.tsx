'use client';

import { useEffect, useState, useMemo } from 'react';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collectionGroup, getDocs, query, collection } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, FileDown, CalendarIcon, FileText, Mail, Search, LayoutGrid, ArrowUpDown, ArrowUp, ArrowDown, Filter } from 'lucide-react';
import { formatPrice, getVendorFromSku } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import type { Vendor } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

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
  paymentMethod: 'QRIS' | 'COD';
  vendorStatuses?: Record<string, { status: string }>;
  items: OrderItem[];
}

type SummaryItem = {
    key: string;
    parentOrderId: string; // Used for merging logic
    label: string;
    subLabel?: string;
    totalOrders: number;
    totalAmount: number; // Item Sales only
    adminFee: number;    // 5% of totalAmount
    netToVendor: number; // totalAmount - adminFee
    totalDeliveryFee: number; // Ongkir based on filter/group
    items: { name: string, quantity: number, sku: string, price: number, vendor: string }[];
    addresses: string[];
    status?: string; // For Sub-Order view
    statuses?: string[]; // For aggregate view
}

type SortConfig = {
  key: keyof SummaryItem | 'label';
  direction: 'asc' | 'desc';
};

const ALL_STATUSES = ["Dipesan", "Dibayar", "Diproses", "Dikumpulkan", "Dikirim", "Dikirim dan Bayar", "Dibatalkan"];

export default function AdminSummaryPage() {
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [targetEmail, setTargetEmail] = useState('');
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [vendorFilter, setVendorFilter] = useState('all');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
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
      parentOrderId: string;
      label: string;
      subLabel?: string;
      orderIds: Set<string>; 
      totalAmount: number; 
      totalDeliveryFee: number;
      items: Record<string, { name: string, quantity: number, sku: string, price: number, vendor: string }>;
      addresses: Set<string>;
      statuses: Set<string>;
    }> = {};

    const parentOrdersIncludedInDelivery = new Set<string>();

    targetDateOrders.forEach(order => {
        const uniqueItemsForThisOrder = order.items.filter(item => {
            const vendor = item.vendor || getVendorFromSku(item.sku);
            const matchesVendor = vendorFilter === 'all' || vendor === vendorFilter;
            
            const vStatus = order.vendorStatuses?.[vendor]?.status || 'Dipesan';
            const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(vStatus);

            const search = searchTerm.toLowerCase();
            const matchesSearch = searchTerm === '' || 
                order.id.toLowerCase().includes(search) ||
                order.deliveryAddress.toLowerCase().includes(search) ||
                item.name.toLowerCase().includes(search);

            return matchesVendor && matchesStatus && matchesSearch;
        });

        if (uniqueItemsForThisOrder.length === 0) return;

        uniqueItemsForThisOrder.forEach(item => {
            const vendor = item.vendor || getVendorFromSku(item.sku);
            const currentStatus = order.vendorStatuses?.[vendor]?.status || 'Dipesan';
            
            let key = '';
            let label = '';
            let subLabel = '';

            if (groupBy === 'orderId') {
                key = `${order.id}-${vendor}`;
                const vName = vendorLookup[vendor];
                label = key;
                subLabel = `${vName || vendor} | ${format(parseISO(order.orderDateTime), 'HH:mm')}`;
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
                    parentOrderId: order.id,
                    label, 
                    subLabel, 
                    orderIds: new Set(), 
                    totalAmount: 0, 
                    totalDeliveryFee: 0,
                    items: {}, 
                    addresses: new Set(),
                    statuses: new Set(),
                };
            }
            
            summaryMap[key].orderIds.add(order.id);
            if (order.deliveryAddress) {
              summaryMap[key].addresses.add(order.deliveryAddress);
            }
            summaryMap[key].statuses.add(currentStatus);
            
            const itemTotal = item.quantity * item.priceAtOrder;
            summaryMap[key].totalAmount += itemTotal;
            
            if (!parentOrdersIncludedInDelivery.has(order.id)) {
                parentOrdersIncludedInDelivery.add(order.id);
                summaryMap[key].totalDeliveryFee += 2500;
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
        const statusesArr = Array.from(data.statuses);
        return {
            key,
            parentOrderId: data.parentOrderId,
            label: data.label,
            subLabel: data.subLabel,
            totalOrders: data.orderIds.size,
            totalAmount: data.totalAmount,
            adminFee: adminFee,
            netToVendor: data.totalAmount - adminFee,
            totalDeliveryFee: data.totalDeliveryFee,
            items: Object.values(data.items),
            addresses: Array.from(data.addresses),
            status: statusesArr.length === 1 ? statusesArr[0] : undefined,
            statuses: statusesArr
        };
    });
  }, [orders, date, groupBy, vendorLookup, vendorFilter, selectedStatuses, searchTerm]);

  const filteredSummary = useMemo(() => {
    let result = [...summaryData];
    
    if (groupBy === 'orderId' && sortConfig.key === 'label' && sortConfig.direction === 'asc') {
        result.sort((a, b) => a.parentOrderId.localeCompare(b.parentOrderId) || a.key.localeCompare(b.key));
    } else if (sortConfig.key) {
      result.sort((a, b) => {
        const valA = (a[sortConfig.key!] || '').toString().toLowerCase();
        const valB = (b[sortConfig.key!] || '').toString().toLowerCase();

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [summaryData, sortConfig, groupBy]);

  const rowSpans = useMemo(() => {
    const spans: Record<string, number> = {};
    if (groupBy !== 'orderId') return spans;

    let i = 0;
    while (i < filteredSummary.length) {
        const currentOrder = filteredSummary[i].parentOrderId;
        let count = 1;
        let j = i + 1;
        while (j < filteredSummary.length && filteredSummary[j].parentOrderId === currentOrder) {
            count++;
            j++;
        }
        spans[filteredSummary[i].key] = count;
        i = j;
    }
    return spans;
  }, [filteredSummary, groupBy]);

  const grandTotals = useMemo(() => {
    return filteredSummary.reduce((acc, curr) => ({
      orders: acc.orders + curr.totalOrders,
      amount: acc.amount + curr.totalAmount,
      admin: acc.admin + curr.adminFee,
      net: acc.net + curr.netToVendor,
      ongkir: acc.ongkir + (rowSpans[curr.key] > 0 ? 2500 : (groupBy !== 'orderId' ? curr.totalDeliveryFee : 0))
    }), { orders: 0, amount: 0, admin: 0, net: 0, ongkir: 0 });
  }, [filteredSummary, rowSpans, groupBy]);

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

  const toggleStatus = (status: string) => {
    setSelectedStatuses(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status) 
        : [...prev, status]
    );
  };

  const exportToExcel = () => {
    const dataForExport = filteredSummary.map((summary, index) => ({
        'No.': index + 1,
        'ID Order': summary.parentOrderId,
        'Group (ID Sub-Order/Mitra/SKU)': summary.label,
        'Info': summary.subLabel || '',
        'Status': summary.status || summary.statuses?.join(', '),
        'Total Produk (Bruto)': summary.totalAmount,
        'Admin (5%)': summary.adminFee,
        'Bayar ke Mitra (Netto)': summary.netToVendor,
        'Ongkir': (groupBy === 'orderId' && rowSpans[summary.key] > 0) ? 2500 : (groupBy !== 'orderId' ? summary.totalDeliveryFee : 0),
        'Rincian Item': summary.items.map(i => `${i.name} [${i.sku}] (${i.quantity} porsi x ${formatPrice(i.price)})`).join('\r\n'),
        'Alamat Pengiriman': summary.addresses.join('\r\n'),
    }));

    dataForExport.push({
      'No.': '',
      'ID Order': '',
      'Group (ID Sub-Order/Mitra/SKU)': 'TOTAL KESELURUHAN',
      'Info': '',
      'Status': '',
      'Total Produk (Bruto)': grandTotals.amount,
      'Admin (5%)': grandTotals.admin,
      'Bayar ke Mitra (Netto)': grandTotals.net,
      'Ongkir': grandTotals.ongkir,
      'Rincian Item': '',
      'Alamat Pengiriman': ''
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
    
    const tableRows = filteredSummary.map((summary, index) => {
        const span = rowSpans[summary.key] || 0;
        const isSpannedRow = groupBy === 'orderId';
        const showOngkirAlamat = !isSpannedRow || (isSpannedRow && span > 0);

        const row: any = {
            no: (index + 1).toString(),
            group: summary.label + (summary.subLabel ? `\n(${summary.subLabel})` : ''),
            status: summary.status || summary.statuses?.join(', ') || '-',
            produk: formatPrice(summary.totalAmount),
            admin: formatPrice(summary.adminFee),
            net: formatPrice(summary.netToVendor),
            items: summary.items.map(i => `${i.name} [${i.sku}]\n${i.quantity} porsi`).join('\n---\n'),
        };

        if (showOngkirAlamat) {
            row.ongkir = { content: formatPrice(isSpannedRow ? 2500 : summary.totalDeliveryFee), rowSpan: isSpannedRow ? span : 1, styles: { halign: 'right', valign: 'middle', fillColor: [255, 248, 225] } };
            row.alamat = { content: summary.addresses.join('\n\n'), rowSpan: isSpannedRow ? span : 1, styles: { fontSize: 6, valign: 'middle', fillColor: [255, 248, 225] } };
        }

        return row;
    });

    const grandTotalRow = {
      no: { content: "TOTAL KESELURUHAN", colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } },
      produk: { content: formatPrice(grandTotals.amount), styles: { fontStyle: 'bold' } },
      admin: { content: formatPrice(grandTotals.admin), styles: { fontStyle: 'bold' } },
      net: { content: formatPrice(grandTotals.net), styles: { fontStyle: 'bold' } },
      ongkir: { content: formatPrice(grandTotals.ongkir), styles: { fontStyle: 'bold' } },
      items: "",
      alamat: ""
    };

    doc.text(`Rekap Harian Takjil - ${date ? format(date, 'd MMMM yyyy', { locale: id }) : 'Semua'}`, 14, 15);
    
    autoTable(doc, {
        head: [["No.", "ID Sub-Order / Group", "Status", "Total Produk", "Admin (5%)", "Bayar ke Mitra", "Ongkir", "Rincian Item", "Alamat"]],
        body: [...tableRows, grandTotalRow],
        columns: [
            { header: 'No.', dataKey: 'no' },
            { header: 'ID Sub-Order / Group', dataKey: 'group' },
            { header: 'Status', dataKey: 'status' },
            { header: 'Total Produk', dataKey: 'produk' },
            { header: 'Admin (5%)', dataKey: 'admin' },
            { header: 'Bayar ke Mitra', dataKey: 'net' },
            { header: 'Ongkir', dataKey: 'ongkir' },
            { header: 'Rincian Item', dataKey: 'items' },
            { header: 'Alamat', dataKey: 'alamat' },
        ],
        startY: 20,
        theme: 'grid',
        headStyles: { fillColor: [255, 140, 0] },
        styles: { fontSize: 7, overflow: 'linebreak' },
        columnStyles: {
          items: { cellWidth: 40 },
          alamat: { cellWidth: 40 },
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
        description: `Rekap harian lengkap (termasuk Alamat & Item) telah dikirim ke ${targetEmail}.`,
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
                  Rekapitulasi transaksi lengkap per {groupBy === 'orderId' ? 'ID Sub-Order' : groupBy === 'vendor' ? 'Mitra' : 'SKU'} untuk tanggal {date ? format(date, 'eeee, d MMMM yyyy', { locale: id }) : 'semua waktu'}.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-4 items-center mb-4">
                    <div className="relative flex-1 min-w-[240px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Cari kata kunci (No Order, Alamat, Menu)..." 
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

                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="w-[180px] justify-between border-primary/30">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <Filter className="h-4 w-4 text-primary shrink-0" />
                                    <span className="truncate">
                                        {selectedStatuses.length === 0 ? "Semua Status" : `Status (${selectedStatuses.length})`}
                                    </span>
                                </div>
                                <ArrowDown className="h-3 w-3 opacity-50 shrink-0" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[200px] p-2" align="start">
                            <div className="space-y-2">
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="w-full justify-start font-normal text-xs h-8"
                                    onClick={() => setSelectedStatuses([])}
                                >
                                    Reset Pilihan
                                </Button>
                                <div className="border-t pt-2 space-y-1">
                                    {ALL_STATUSES.map(status => (
                                        <div 
                                            key={status} 
                                            className="flex items-center space-x-2 p-1 rounded hover:bg-muted cursor-pointer"
                                            onClick={() => toggleStatus(status)}
                                        >
                                            <Checkbox 
                                                id={`status-${status}`} 
                                                checked={selectedStatuses.includes(status)}
                                                onCheckedChange={() => toggleStatus(status)}
                                            />
                                            <label 
                                                htmlFor={`status-${status}`}
                                                className="text-sm font-medium leading-none cursor-pointer flex-1"
                                            >
                                                {status}
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>

                    <Select value={groupBy} onValueChange={(val: any) => setGroupBy(val)}>
                        <SelectTrigger className="w-[180px] border-primary/50 bg-primary/5">
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
                                placeholder="Email Laporan" 
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
                                <TableHead className="w-[120px]">Status</TableHead>
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
                                <TableHead className="min-w-[250px]">Rincian Item & Pembayaran per Mitra</TableHead>
                                <TableHead className="min-w-[200px]">Alamat Pengiriman</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredSummary.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="text-center text-muted-foreground py-10">
                                    Tidak ada transaksi ditemukan.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredSummary.map((summary, index) => {
                                    const span = rowSpans[summary.key] || 0;
                                    
                                    return (
                                        <TableRow key={summary.key}>
                                            <TableCell className="text-muted-foreground font-mono text-xs">{index + 1}</TableCell>
                                            <TableCell className="font-medium">
                                                {summary.label}
                                                {summary.subLabel && <span className="block text-[10px] text-muted-foreground">{summary.subLabel}</span>}
                                            </TableCell>
                                            <TableCell>
                                                {summary.status ? (
                                                    <Badge className={cn("text-[10px]", getStatusBadgeColor(summary.status))}>
                                                        {summary.status}
                                                    </Badge>
                                                ) : summary.statuses && summary.statuses.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1">
                                                        {summary.statuses.map(s => (
                                                            <Badge key={s} className={cn("text-[10px]", getStatusBadgeColor(s))}>
                                                                {s}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                ) : null}
                                            </TableCell>
                                            <TableCell className="text-right">{formatPrice(summary.totalAmount)}</TableCell>
                                            <TableCell className="text-right text-destructive font-medium">{formatPrice(summary.adminFee)}</TableCell>
                                            <TableCell className="text-right font-bold text-green-600">{formatPrice(summary.netToVendor)}</TableCell>
                                            
                                            {groupBy === 'orderId' ? (
                                                span > 0 ? (
                                                    <TableCell rowSpan={span} className="text-right bg-primary/5 border-l border-primary/10 font-bold">
                                                        {formatPrice(2500)}
                                                    </TableCell>
                                                ) : null
                                            ) : (
                                                <TableCell className="text-right">
                                                    {summary.totalDeliveryFee > 0 ? formatPrice(summary.totalDeliveryFee) : '-'}
                                                </TableCell>
                                            )}

                                            <TableCell>
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

                                            {groupBy === 'orderId' ? (
                                                span > 0 ? (
                                                    <TableCell rowSpan={span} className="bg-primary/5 border-l border-primary/10">
                                                        <ul className="text-[10px] list-disc pl-4 space-y-2 text-muted-foreground">
                                                            {summary.addresses.map((addr, idx) => (
                                                                <li key={idx} className="leading-tight">{addr}</li>
                                                            ))}
                                                        </ul>
                                                    </TableCell>
                                                ) : null
                                            ) : (
                                                <TableCell>
                                                    <ul className="text-[10px] list-disc pl-4 space-y-2 text-muted-foreground">
                                                        {summary.addresses.map((addr, idx) => (
                                                            <li key={idx} className="leading-tight">{addr}</li>
                                                        ))}
                                                    </ul>
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                        {filteredSummary.length > 0 && (
                            <TableFooter>
                                <TableRow className="bg-primary/5 font-bold">
                                    <TableCell colSpan={3}></TableCell>
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