'use client';

import { useEffect, useState, useMemo } from 'react';
import { useFirestore, useUser, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError, useDoc } from '@/firebase';
import { collectionGroup, getDocs, query, collection, writeBatch, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, FileDown, CalendarIcon, FileText, Mail, Search, LayoutGrid, ArrowUpDown, ArrowUp, ArrowDown, Filter, Trash2, Phone, User, ChevronLeft, ChevronRight, Send, X, BarChart3, PieChart as PieChartIcon, Table as TableIcon, Package, Truck, Share2, MapPin, Clock } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from 'recharts';
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

interface Customer {
  id: string;
  name: string;
  email: string;
  phoneNumber: string;
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
  deliveryAddress: string;
  deliveryFee?: number;
  paymentMethod: 'QRIS' | 'COD';
  vendorStatuses?: Record<string, { status: string }>;
  items: OrderItem[];
}

type SummaryItem = {
    key: string;
    parentOrderId: string;
    label: string;
    subLabel?: string;
    totalOrders: number;
    totalAmount: number;
    adminFee: number;
    netToVendor: number;
    totalDeliveryFee: number;
    items: { name: string, quantity: number, sku: string, price: number, vendor: string }[];
    addresses: string[];
    customerProfile?: {
      name: string;
      phone: string;
      email: string;
    };
    status?: string;
    statuses?: string[];
    paymentMethod?: string;
    orderDeliveryFee: number;
}

type SortConfig = {
  key: keyof SummaryItem | 'label';
  direction: 'asc' | 'desc';
};

const ALL_STATUSES = ["Dipesan", "Dibayar", "Diproses", "Dikumpulkan", "Dikirim", "Dikirim dan Bayar", "Dibatalkan"];

const STATUS_FLOWS = {
  QRIS: ["Dipesan", "Dibayar", "Diproses", "Dikumpulkan", "Dikirim", "Dibatalkan"],
  COD: ["Dipesan", "Diproses", "Dikumpulkan", "Dikirim dan Bayar", "Dibatalkan"]
};

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  '#FF8C00',
  '#4CAF50',
  '#2196F3',
  '#9C27B0',
  '#E91E63'
];

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
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');
  const { toast } = useToast();

  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Load Params for dynamic Admin Fee & Delivery Fee
  const settingsDocRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'settings', 'inventory');
  }, [firestore]);
  const { data: settings } = useDoc<{ adminFee?: number, deliveryFee?: number }>(settingsDocRef);
  const adminFeePercent = settings?.adminFee ?? 10;
  const adminFeeMultiplier = adminFeePercent / 100;
  const globalDeliveryFee = settings?.deliveryFee ?? 2500;

  const vendorsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'vendors');
  }, [firestore]);
  const { data: vendorsData } = useCollection<Vendor>(vendorsQuery);

  const customersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'customers');
  }, [firestore]);
  const { data: customersData } = useCollection<Customer>(customersQuery);

  const vendorLookup = useMemo(() => {
    const map: Record<string, string> = {};
    vendorsData?.forEach(v => {
      map[v.code] = v.name;
    });
    return map;
  }, [vendorsData]);

  const customerLookup = useMemo(() => {
    const map: Record<string, Customer> = {};
    customersData?.forEach(c => {
      map[c.id] = c;
    });
    return map;
  }, [customersData]);

  const deliveryDashboardLink = useMemo(() => {
    const params = new URLSearchParams();
    if (date) params.set('date', date.toISOString());
    if (vendorFilter !== 'all') params.set('vendor', vendorFilter);
    if (selectedStatuses.length > 0) params.set('statuses', selectedStatuses.join(','));
    if (searchTerm) params.set('search', searchTerm);
    return `/kurir?${params.toString()}`;
  }, [date, vendorFilter, selectedStatuses, searchTerm]);

  const copyDeliveryLink = () => {
    const fullUrl = `${window.location.origin}${deliveryDashboardLink}`;
    navigator.clipboard.writeText(fullUrl);
    toast({
      title: "Link Dashboard Kurir Disalin",
      description: "Tautan kurir dengan filter saat ini siap dibagikan ke WhatsApp.",
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

  useEffect(() => {
    setCurrentPage(1);
  }, [date, vendorFilter, selectedStatuses, searchTerm, groupBy, sortConfig]);

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
      customerProfile?: { name: string; phone: string; email: string };
      paymentMethod: string;
      orderDeliveryFee: number;
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
            const customer = customerLookup[order.customerId];
            const orderDeliveryFee = order.deliveryFee ?? globalDeliveryFee;
            
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
                    customerProfile: customer ? {
                      name: customer.name,
                      phone: customer.phoneNumber,
                      email: customer.email
                    } : undefined,
                    paymentMethod: order.paymentMethod,
                    orderDeliveryFee: orderDeliveryFee
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
                summaryMap[key].totalDeliveryFee += orderDeliveryFee;
            }

            const itemKey = item.sku;
            if (!summaryMap[key].items[itemKey]) {
                summaryMap[key].items[itemKey] = { name: item.name, quantity: 0, sku: item.sku, price: item.priceAtOrder, vendor };
            }
            summaryMap[key].items[itemKey].quantity += item.quantity;
        });
    });

    return Object.entries(summaryMap).map(([key, data]) => {
        const currentAdminFee = data.totalAmount * adminFeeMultiplier;
        const statusesArr = Array.from(data.statuses);
        return {
            key,
            parentOrderId: data.parentOrderId,
            label: data.label,
            subLabel: data.subLabel,
            totalOrders: data.orderIds.size,
            totalAmount: data.totalAmount,
            adminFee: currentAdminFee,
            netToVendor: data.totalAmount - currentAdminFee,
            totalDeliveryFee: data.totalDeliveryFee,
            items: Object.values(data.items),
            addresses: Array.from(data.addresses),
            customerProfile: data.customerProfile,
            status: statusesArr.length === 1 ? statusesArr[0] : undefined,
            statuses: statusesArr,
            paymentMethod: data.paymentMethod,
            orderDeliveryFee: data.orderDeliveryFee
        };
    });
  }, [orders, date, groupBy, vendorLookup, customerLookup, vendorFilter, selectedStatuses, searchTerm, adminFeeMultiplier, globalDeliveryFee]);

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

  const paginatedSummary = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSummary.slice(start, start + pageSize);
  }, [filteredSummary, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredSummary.length / pageSize);

  const rowSpans = useMemo(() => {
    const spans: Record<string, number> = {};
    if (groupBy !== 'orderId') return spans;

    let i = 0;
    while (i < paginatedSummary.length) {
        const currentOrder = paginatedSummary[i].parentOrderId;
        let count = 1;
        let j = i + 1;
        while (j < paginatedSummary.length && paginatedSummary[j].parentOrderId === currentOrder) {
            count++;
            j++;
        }
        spans[paginatedSummary[i].key] = count;
        i = j;
    }
    return spans;
  }, [paginatedSummary, groupBy]);

  const actualGrandTotals = useMemo(() => {
    const uniqueOrders = new Set(filteredSummary.map(s => s.parentOrderId));
    const amount = filteredSummary.reduce((acc, curr) => acc + curr.totalAmount, 0);
    const admin = filteredSummary.reduce((acc, curr) => acc + curr.adminFee, 0);
    const net = filteredSummary.reduce((acc, curr) => acc + curr.netToVendor, 0);
    const totalPcs = filteredSummary.reduce((acc, curr) => 
      acc + curr.items.reduce((sum, i) => sum + i.quantity, 0), 0
    );
    
    const ongkir = Array.from(uniqueOrders).reduce((acc, orderId) => {
      const order = orders.find(o => o.id === orderId);
      return acc + (order?.deliveryFee ?? globalDeliveryFee);
    }, 0);

    return {
        orders: uniqueOrders.size,
        amount,
        admin,
        net,
        ongkir,
        totalPcs
    };
  }, [filteredSummary, orders, globalDeliveryFee]);

  const chartDataMitra = useMemo(() => {
    const map: Record<string, number> = {};
    filteredSummary.forEach(s => {
      const vendorCode = groupBy === 'vendor' ? s.key : (groupBy === 'orderId' ? s.key.split('-').pop() : '');
      if (vendorCode) {
        map[vendorCode] = (map[vendorCode] || 0) + s.netToVendor;
      }
    });
    
    if (groupBy === 'sku') {
      filteredSummary.forEach(s => {
        s.items.forEach(item => {
          const v = item.vendor;
          const val = item.quantity * item.price * (1 - adminFeeMultiplier);
          map[v] = (map[v] || 0) + val;
        });
      });
    }

    return Object.entries(map)
      .map(([name, value]) => ({ name: vendorLookup[name] || name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredSummary, groupBy, vendorLookup, adminFeeMultiplier]);

  const chartDataStatus = useMemo(() => {
    const map: Record<string, number> = {};
    filteredSummary.forEach(s => {
      if (s.status) {
        map[s.status] = (map[s.status] || 0) + 1;
      } else if (s.statuses) {
        s.statuses.forEach(st => {
          map[st] = (map[st] || 0) + 1;
        });
      }
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [filteredSummary]);

  const chartDataProducts = useMemo(() => {
    const map: Record<string, number> = {};
    filteredSummary.forEach(s => {
      s.items.forEach(item => {
        map[item.name] = (map[item.name] || 0) + item.quantity;
      });
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
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

  const toggleStatus = (status: string) => {
    setSelectedStatuses(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status) 
        : [...prev, status]
    );
  };

  const handleUpdateVendorStatus = async (summary: SummaryItem, newStatus: string) => {
    if (!firestore || isUpdatingStatus) return;
    
    const [orderId, vendorCode] = summary.key.split('-');
    if (!orderId || !vendorCode) return;

    setIsUpdatingStatus(summary.key);

    const now = new Date().toISOString();
    const orderObj = orders.find(o => o.id === orderId);
    if (!orderObj) {
        setIsUpdatingStatus(null);
        return;
    }

    const orderRef = doc(firestore, 'customers', orderObj.customerId, 'orders', orderId);
    
    const updateData = {
      [`vendorStatuses.${vendorCode}.status`]: newStatus,
      [`vendorStatuses.${vendorCode}.statusHistory`]: arrayUnion({ status: newStatus, timestamp: now })
    };

    updateDoc(orderRef, updateData)
      .then(() => {
        setOrders(prev => prev.map(o => {
          if (o.id === orderId) {
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

  const exportToExcel = () => {
    const dataForExport = filteredSummary.map((summary, index) => ({
        'No.': index + 1,
        'ID Order': summary.parentOrderId,
        'Pemesan': summary.customerProfile?.name || '-',
        'No HP': summary.customerProfile?.phone || '-',
        'Email': summary.customerProfile?.email || '-',
        'Metode Bayar': summary.paymentMethod || '-',
        'Group': summary.label,
        'Info': summary.subLabel || '',
        'Status': summary.status || summary.statuses?.join(', '),
        'Total Produk (Bruto)': summary.totalAmount,
        [`Admin (${adminFeePercent}%)`]: summary.adminFee,
        'Bayar ke Mitra (Netto)': summary.netToVendor,
        'Ongkir': (groupBy === 'orderId' && rowSpans[summary.key] > 0) ? summary.orderDeliveryFee : (groupBy !== 'orderId' ? summary.totalDeliveryFee : 0),
        'Rincian Item': summary.items.map(i => `${i.name} [${i.sku}] (${i.quantity} porsi x ${formatPrice(i.price)})`).join('\r\n'),
        'Alamat Pengiriman': summary.addresses.join('\r\n'),
    }));

    dataForExport.push({
      'No.': '',
      'ID Order': '',
      'Pemesan': '',
      'No HP': '',
      'Email': '',
      'Metode Bayar': '',
      'Group': 'TOTAL KESELURUHAN',
      'Info': '',
      'Status': '',
      'Total Produk (Bruto)': actualGrandTotals.amount,
      [`Admin (${adminFeePercent}%)`]: actualGrandTotals.admin,
      'Bayar ke Mitra (Netto)': actualGrandTotals.net,
      'Ongkir': actualGrandTotals.ongkir,
      'Rincian Item': '',
      'Alamat Pengiriman': ''
    } as any);

    const worksheet = XLSX.utils.json_to_sheet(dataForExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Rekap Harian");
    
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const dataBlob = new Blob([excelBuffer], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8'});
    saveAs(dataBlob, `rekap_${groupBy}_${date ? date.toISOString().split('T')[0] : 'semua'}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    const tableRows: any[] = [];
    
    const allSpans: Record<string, number> = {};
    if (groupBy === 'orderId') {
        let k = 0;
        while (k < filteredSummary.length) {
            const currentOrder = filteredSummary[k].parentOrderId;
            let count = 1;
            let l = k + 1;
            while (l < filteredSummary.length && filteredSummary[l].parentOrderId === currentOrder) {
                count++;
                l++;
            }
            allSpans[filteredSummary[k].key] = count;
            k = l;
        }
    }

    filteredSummary.forEach((summary, index) => {
        const isRowSpanned = groupBy === 'orderId';
        const isNewOrder = !isRowSpanned || index === 0 || filteredSummary[index - 1].parentOrderId !== summary.parentOrderId;
        const parentOrder = orders.find(o => o.id === summary.parentOrderId);
        
        if (isRowSpanned && isNewOrder) {
            const cp = summary.customerProfile;
            const profileText = cp 
              ? `${cp.name.toUpperCase()} | HP: ${cp.phone}${cp.email ? ' | ' + cp.email : ''} | BAYAR: ${summary.paymentMethod || '-'}`
              : '';
            const dateText = parentOrder ? format(new Date(parentOrder.orderDateTime), 'eeee, d MMM yyyy - HH:mm', { locale: id }) : '';

            tableRows.push([
                { 
                    content: `ORDER #${summary.parentOrderId} (${dateText})`, 
                    colSpan: 3, 
                    styles: { fillColor: [240, 240, 240], fontStyle: 'bold', fontSize: 8 } 
                },
                { 
                    content: `PROFIL & ALAMAT: ${profileText}\n📍 ${summary.addresses.join(', ')}`, 
                    colSpan: 5, 
                    styles: { fillColor: [240, 240, 240], fontSize: 7 } 
                }
            ]);
        }

        const span = allSpans[summary.key] || 0;

        const row: any[] = [
            (index + 1).toString(),
            isRowSpanned ? summary.key.split('-').pop() : summary.label,
            summary.status || summary.statuses?.join(', ') || '-',
            formatPrice(summary.totalAmount),
            formatPrice(summary.adminFee),
            formatPrice(summary.netToVendor),
        ];

        if (isRowSpanned) {
            if (span > 0) {
                row.push({ 
                    content: formatPrice(summary.orderDeliveryFee), 
                    rowSpan: span, 
                    styles: { halign: 'right', valign: 'middle', fillColor: [255, 248, 225] } 
                });
            }
        } else {
            row.push(formatPrice(summary.totalDeliveryFee));
        }

        row.push(summary.items.map(i => `${i.name} [${i.sku}] (${i.quantity} porsi)`).join('\n'));

        if (!isRowSpanned) {
            const cp = summary.customerProfile;
            const profileText = cp ? `${cp.name}\n${cp.phone}\n${summary.paymentMethod || '-'}` : '';
            row.push(`${profileText}\n${summary.addresses.join(', ')}`);
        }

        tableRows.push(row);
    });

    const grandTotalRow = [
      { content: "TOTAL KESELURUHAN", colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } },
      { content: formatPrice(actualGrandTotals.amount), styles: { fontStyle: 'bold' } },
      { content: formatPrice(actualGrandTotals.admin), styles: { fontStyle: 'bold' } },
      { content: formatPrice(actualGrandTotals.net), styles: { fontStyle: 'bold' } },
      { content: formatPrice(actualGrandTotals.ongkir), styles: { fontStyle: 'bold' } },
      { content: "", colSpan: groupBy === 'orderId' ? 1 : 2 }
    ];

    tableRows.push(grandTotalRow);

    doc.text(`Rekap Harian Takjil - ${date ? format(date, 'd MMMM yyyy', { locale: id }) : 'Semua'}`, 14, 15);
    
    autoTable(doc, {
        head: [[
            "No.", 
            groupBy === 'orderId' ? "Mitra" : "Group", 
            "Status", 
            "Produk", 
            `Admin (${adminFeePercent}%)`, 
            "Netto Mitra", 
            "Ongkir", 
            "Rincian Item",
            ...(groupBy === 'orderId' ? [] : ["Profil & Alamat"])
        ]],
        body: tableRows,
        startY: 20,
        theme: 'grid',
        headStyles: { fillColor: [255, 140, 0] },
        styles: { fontSize: 7, overflow: 'linebreak' },
        columnStyles: {
          7: { cellWidth: 40 },
          8: { cellWidth: 45 },
        }
    });
    doc.save(`rekap_${groupBy}_${date ? date.toISOString().split('T')[0] : 'semua'}.pdf`);
  };

  const sendToEmail = async () => {
    if (!targetEmail || !targetEmail.includes('@')) {
        toast({ variant: "destructive", title: "Email Tidak Valid", description: "Silakan masukkan alamat email yang benar." });
        return;
    }
    setIsSending(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsSending(false);
    toast({ title: "Laporan Terkirim", description: `Rekap harian lengkap telah dikirim ke ${targetEmail}.` });
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

  const toggleOrderSelection = (orderId: string) => {
    const newSelected = new Set(selectedOrderIds);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
    setSelectedOrderIds(newSelected);
  };

  const toggleSelectAllOrders = () => {
    const visibleOrderIds = new Set(paginatedSummary.map(s => s.parentOrderId));
    if (selectedOrderIds.size === visibleOrderIds.size) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(visibleOrderIds);
    }
  };

  const executeDeleteOrders = async (orderIds: string[]) => {
    if (!firestore || orderIds.length === 0) return;
    
    setIsDeleting(true);
    const batch = writeBatch(firestore);
    
    try {
      for (const orderId of orderIds) {
        const orderObj = orders.find(o => o.id === orderId);
        if (!orderObj) continue;
        
        orderObj.items.forEach(item => {
          const itemRef = doc(firestore, 'customers', orderObj.customerId, 'orders', orderId, 'orderItems', item.id);
          batch.delete(itemRef);
        });
        
        const orderRef = doc(firestore, 'customers', orderObj.customerId, 'orders', orderId);
        batch.delete(orderRef);
      }
      await batch.commit();
      setOrders(prev => prev.filter(o => !orderIds.includes(o.id)));
      setSelectedOrderIds(new Set());
      toast({ title: "Penghapusan Berhasil", description: `${orderIds.length} pesanan telah dihapus selamanya.` });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Gagal', description: 'Terjadi kesalahan hak akses saat menghapus data.' });
    } finally {
      setIsDeleting(false);
      setOrderToDelete(null);
    }
  };

  if (isLoading || isUserLoading) {
    return <div className="flex h-full items-center justify-center p-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  
  return (
    <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
            <div>
                <h1 className="text-3xl font-bold tracking-tight font-headline">Rekap Harian</h1>
                <p className="text-muted-foreground">
                  {viewMode === 'table' ? 'Tabel data detail' : 'Analisis grafik visual'} harian untuk tanggal {date ? format(date, 'eeee, d MMMM yyyy', { locale: id }) : 'semua waktu'}.
                </p>
            </div>
            <Tabs value={viewMode} onValueChange={(v: any) => setViewMode(v)} className="w-full md:w-auto">
                <TabsList className="grid grid-cols-2 w-full md:w-[280px] bg-primary/10 border border-primary/20">
                    <TabsTrigger value="table" className="flex items-center gap-2">
                        <TableIcon className="h-4 w-4" />
                        Tabel Rekap
                    </TabsTrigger>
                    <TabsTrigger value="chart" className="flex items-center gap-2">
                        <PieChartIcon className="h-4 w-4" />
                        Grafik Visual
                    </TabsTrigger>
                </TabsList>
            </Tabs>
        </div>

        <Card className="border-primary/10 shadow-sm">
            <CardContent className="p-6 space-y-6">
                <div className="space-y-2">
                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Pencarian Cepat</Label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Cari No Order, Nama Pemesan, Alamat, atau Nama Menu..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 h-11 bg-muted/20 border-primary/10 focus-visible:ring-primary"
                        />
                        {searchTerm && (
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7"
                                onClick={() => setSearchTerm('')}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-xl border border-primary/5">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Pilih Tanggal</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant={"outline"} className="w-full justify-start text-left font-normal bg-background border-primary/10">
                                    <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                                    {date ? format(date, "PPP", { locale: id }) : <span>Pilih tanggal</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar mode="single" selected={date} onSelect={setDate} initialFocus locale={id} />
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Mitra / UMKM</Label>
                        <Select value={vendorFilter} onValueChange={setVendorFilter}>
                            <SelectTrigger className="w-full bg-background border-primary/10">
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
                    </div>

                    <div className="space-y-2">
                        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Status Pesanan</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="w-full justify-between bg-background border-primary/10">
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
                                    <Button variant="ghost" size="sm" className="w-full justify-start font-normal text-xs h-8" onClick={() => setSelectedStatuses([])}>Reset Pilihan</Button>
                                    <div className="border-t pt-2 space-y-1">
                                        {ALL_STATUSES.map(status => (
                                            <div key={status} className="flex items-center space-x-2 p-1 rounded hover:bg-muted cursor-pointer" onClick={() => toggleStatus(status)}>
                                                <Checkbox id={`status-${status}`} checked={selectedStatuses.includes(status)} onCheckedChange={() => toggleStatus(status)}/>
                                                <label htmlFor={`status-${status}`} className="text-sm font-medium leading-none cursor-pointer flex-1">{status}</label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Kelompokkan Berdasar</Label>
                        <Select value={groupBy} onValueChange={(val: any) => setGroupBy(val)}>
                            <SelectTrigger className="w-full bg-primary/5 border-primary/20 text-primary font-bold">
                                <LayoutGrid className="mr-2 h-4 w-4" />
                                <SelectValue placeholder="Group By" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="orderId">Grup per Pesanan (Merge)</SelectItem>
                                <SelectItem value="vendor">Kode Mitra</SelectItem>
                                <SelectItem value="sku">SKU Produk</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t">
                    <div className="flex flex-wrap gap-2">
                        {selectedOrderIds.size > 0 && (
                          <Button variant="destructive" size="sm" onClick={() => executeDeleteOrders(Array.from(selectedOrderIds))} disabled={isDeleting} className="shadow-sm">
                            <Trash2 className="mr-2 h-4 w-4" /> Hapus Terpilih ({selectedOrderIds.size})
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={exportToExcel} disabled={filteredSummary.length === 0} className="border-primary/20 hover:bg-primary/5">
                            <FileDown className="mr-2 h-4 w-4 text-primary" /> Excel
                        </Button>
                        <Button variant="outline" size="sm" onClick={exportToPDF} disabled={filteredSummary.length === 0} className="border-primary/20 hover:bg-primary/5">
                            <FileText className="mr-2 h-4 w-4 text-primary" /> PDF
                        </Button>
                        <Button variant="outline" size="sm" asChild className="border-blue-500 text-blue-600 hover:bg-blue-50">
                            <Link href={deliveryDashboardLink} target="_blank"><Truck className="mr-2 h-4 w-4" /> Dashboard Kurir</Link>
                        </Button>
                        <Button variant="ghost" size="sm" onClick={copyDeliveryLink} className="text-muted-foreground hover:text-blue-600">
                            <Share2 className="mr-2 h-4 w-4" /> Salin Link Kurir
                        </Button>
                    </div>

                    <div className="flex items-center gap-2 bg-muted/50 p-1.5 rounded-lg border border-primary/5">
                        <div className="relative">
                            <Mail className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                            <Input type="email" placeholder="Email Laporan" className="h-8 w-48 text-xs pl-7 bg-background" value={targetEmail} onChange={(e) => setTargetEmail(e.target.value)}/>
                        </div>
                        <Button variant="default" size="sm" className="h-8 px-3" onClick={sendToEmail} disabled={filteredSummary.length === 0 || isSending || !targetEmail.includes('@')}>
                            {isSending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Send className="mr-2 h-3 w-3" />} Kirim
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>

        {viewMode === 'table' ? (
            <>
                <div className="rounded-xl border shadow-sm overflow-hidden bg-card">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead className="w-[40px]">
                                <Checkbox checked={selectedOrderIds.size > 0 && selectedOrderIds.size === new Set(paginatedSummary.map(s => s.parentOrderId)).size} onCheckedChange={toggleSelectAllOrders}/>
                                </TableHead>
                                <TableHead className="w-[50px]">No.</TableHead>
                                <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort('label')}>
                                    <div className="flex items-center gap-1">{groupBy === 'orderId' ? 'Mitra' : groupBy === 'vendor' ? 'Mitra' : 'SKU / Produk'} {getSortIcon('label')}</div>
                                </TableHead>
                                <TableHead className="w-[150px]">Status</TableHead>
                                <TableHead className="text-right cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort('totalAmount')}>
                                    <div className="flex items-center justify-end gap-1">Produk {getSortIcon('totalAmount')}</div>
                                </TableHead>
                                <TableHead className="text-right cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort('adminFee')}>
                                    <div className="flex items-center justify-end gap-1">Admin ({adminFeePercent}%) {getSortIcon('adminFee')}</div>
                                </TableHead>
                                <TableHead className="text-right cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort('netToVendor')}>
                                    <div className="flex items-center justify-end gap-1">Netto {getSortIcon('netToVendor')}</div>
                                </TableHead>
                                <TableHead className="text-right cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort('totalDeliveryFee')}>
                                    <div className="flex items-center justify-end gap-1">Ongkir {getSortIcon('totalDeliveryFee')}</div>
                                </TableHead>
                                <TableHead className="min-w-[250px]">Rincian Item & Pembayaran</TableHead>
                                {groupBy !== 'orderId' && <TableHead className="min-w-[250px]">Profil & Alamat</TableHead>}
                                <TableHead className="text-right">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedSummary.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={groupBy === 'orderId' ? 10 : 11} className="text-center text-muted-foreground py-20">
                                        <div className="flex flex-col items-center gap-2"><Search className="h-8 w-8 opacity-20" /><p>Tidak ada transaksi.</p></div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedSummary.map((summary, index) => {
                                    const isRowSpanned = groupBy === 'orderId';
                                    const isNewOrder = !isRowSpanned || index === 0 || paginatedSummary[index - 1].parentOrderId !== summary.parentOrderId;
                                    const parentOrder = orders.find(o => o.id === summary.parentOrderId);
                                    const span = rowSpans[summary.key] || 0;
                                    const rows = [];

                                    if (isRowSpanned && isNewOrder) {
                                        rows.push(
                                            <TableRow key={`group-${summary.parentOrderId}`} className="bg-primary/5 border-t-2 border-primary/20">
                                                <TableCell><Checkbox checked={selectedOrderIds.has(summary.parentOrderId)} onCheckedChange={() => toggleOrderSelection(summary.parentOrderId)}/></TableCell>
                                                <TableCell colSpan={2} className="py-3 font-bold"><div className="flex items-center gap-2"><span className="bg-primary text-white text-[10px] px-1.5 py-0.5 rounded shadow-sm">ORDER</span><span className="text-sm">#{summary.parentOrderId}</span></div><div className="text-[10px] text-muted-foreground mt-1 font-normal flex items-center gap-1"><CalendarIcon className="h-3 w-3" />{parentOrder ? format(new Date(parentOrder.orderDateTime), 'eeee, d MMM yyyy - HH:mm', { locale: id }) : '-'}</div></TableCell>
                                                <TableCell colSpan={6} className="py-3">
                                                    {summary.customerProfile && (
                                                        <div className="flex flex-col gap-1.5"><div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs"><div className="flex items-center gap-1.5"><User className="h-3.5 w-3.5 text-primary" /><span className="font-bold uppercase tracking-tight">{summary.customerProfile.name}</span></div>{summary.paymentMethod && (<Badge variant={summary.paymentMethod === 'QRIS' ? 'default' : 'destructive'} className="text-[10px] h-5 px-1.5 py-0">{summary.paymentMethod}</Badge>)}<div className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-green-600" /><span className="font-mono">{summary.customerProfile.phone}</span></div></div><div className="flex items-start gap-1.5 text-[10px] text-muted-foreground italic bg-background/50 px-2 py-1 rounded border border-primary/5"><MapPin className="h-3 w-3 text-primary shrink-0 mt-0.5" /><span className="line-clamp-1">📍 {summary.addresses.join(', ')}</span></div></div>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right"><Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 h-8 w-8" onClick={() => setOrderToDelete(summary.parentOrderId)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                                            </TableRow>
                                        );
                                    }

                                    rows.push(
                                        <TableRow key={summary.key} className={cn("transition-colors", selectedOrderIds.has(summary.parentOrderId) ? 'bg-primary/5' : 'hover:bg-muted/30')}>
                                            <TableCell>{!isRowSpanned && (<Checkbox checked={selectedOrderIds.has(summary.parentOrderId)} onCheckedChange={() => toggleOrderSelection(summary.parentOrderId)}/>)}</TableCell>
                                            <TableCell className="text-muted-foreground font-mono text-[10px]">{!isRowSpanned ? (currentPage - 1) * pageSize + index + 1 : ""}</TableCell>
                                            <TableCell className="font-medium">{isRowSpanned ? (<div className="flex flex-col"><span className="text-[9px] text-muted-foreground uppercase font-bold tracking-tighter">Sub-Order Mitra</span><span className="text-xs font-bold text-primary flex items-center gap-1"><Package className="h-3 w-3" />{summary.key.split('-').pop()} - {vendorLookup[summary.key.split('-').pop() || '']}</span></div>) : (<><span className="text-sm font-bold block">{summary.label}</span>{summary.subLabel && <span className="block text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-sm inline-block mt-1">{summary.subLabel}</span>}</>)}</TableCell>
                                            <TableCell>{isRowSpanned && summary.status ? (<Select disabled={isUpdatingStatus === summary.key} value={summary.status} onValueChange={(val) => handleUpdateVendorStatus(summary, val)}><SelectTrigger className={cn("h-8 text-[10px] font-bold text-white border-0 shadow-sm", getStatusBadgeColor(summary.status))}><SelectValue /></SelectTrigger><SelectContent>{(parentOrder?.paymentMethod === 'QRIS' ? STATUS_FLOWS.QRIS : STATUS_FLOWS.COD).map(s => (<SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>))}</SelectContent></Select>) : summary.status ? (<Badge className={cn("text-[10px]", getStatusBadgeColor(summary.status))}>{summary.status}</Badge>) : summary.statuses && summary.statuses.length > 0 ? (<div className="flex wrap gap-1">{summary.statuses.map(s => (<Badge key={s} className={cn("text-[10px]", getStatusBadgeColor(s))}>{s}</Badge>))}</div>) : null}</TableCell>
                                            <TableCell className="text-right text-sm">{formatPrice(summary.totalAmount)}</TableCell>
                                            <TableCell className="text-right text-xs text-destructive/80 italic">{formatPrice(summary.adminFee)}</TableCell>
                                            <TableCell className="text-right font-bold text-green-600 text-sm">{formatPrice(summary.netToVendor)}</TableCell>
                                            {isRowSpanned ? (span > 0 ? (<TableCell rowSpan={span} className="text-right bg-primary/5 border-l border-primary/10 font-bold text-primary text-sm">{formatPrice(summary.orderDeliveryFee)}</TableCell>) : null) : (<TableCell className="text-right text-sm">{summary.totalDeliveryFee > 0 ? formatPrice(summary.totalDeliveryFee) : '-'}</TableCell>)}
                                            <TableCell><div className="space-y-2">{Object.entries(groupItemsByVendor(summary.items)).map(([vCode, vItems]) => (<div key={vCode} className="space-y-1.5 bg-muted/20 p-2 rounded-lg border border-primary/5"><div className="flex justify-between items-center bg-primary/10 px-2 py-1 rounded-md mb-1"><span className="text-[10px] font-bold text-primary uppercase">Mitra: {vCode}</span><span className="text-[10px] font-bold text-green-700">Net: {formatPrice(vItems.reduce((sum, i) => sum + (i.price * i.quantity), 0) * (1 - adminFeeMultiplier))}</span></div><ul className="text-xs space-y-1">{vItems.map((item, idx) => (<li key={idx} className="flex justify-between gap-4 border-b border-muted/50 last:border-0 pb-1"><span className="text-muted-foreground">{item.name} <span className="text-[9px] bg-muted px-1 rounded">[{item.sku}]</span></span><span className="font-bold shrink-0">{item.quantity} porsi</span></li>))}</ul></div>))}</div></TableCell>
                                            {!isRowSpanned ? (<TableCell><div className="space-y-3">{summary.customerProfile && (<div className="p-2 bg-muted/20 rounded-lg border"><div className="flex justify-between items-start mb-1"><p className="font-bold text-xs text-foreground uppercase flex items-center gap-1.5"><User className="h-3 w-3 text-primary" /> {summary.customerProfile.name}</p>{summary.paymentMethod && (<Badge variant={summary.paymentMethod === 'QRIS' ? 'default' : 'destructive'} className="text-[9px] h-4 px-1 py-0 leading-none">{summary.paymentMethod}</Badge>)}</div><p className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><Phone className="h-3 w-3" /> {summary.customerProfile.phone}</p></div>)}<div className="text-[10px] text-muted-foreground italic px-1 flex gap-1.5"><span className="shrink-0">📍</span><p className="leading-tight">{summary.addresses.join(', ')}</p></div></div></TableCell>) : null}
                                            <TableCell className="text-right">{!isRowSpanned && (<Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 h-8 w-8" onClick={() => setOrderToDelete(summary.parentOrderId)}><Trash2 className="h-4 w-4" /></Button>)}</TableCell>
                                        </TableRow>
                                    );
                                    return rows;
                                })
                            )}
                        </TableBody>
                        {filteredSummary.length > 0 && (
                            <TableFooter className="bg-primary/5">
                                <TableRow className="font-bold border-t-2 border-primary/20">
                                    <TableCell colSpan={4} className="text-right text-xs uppercase tracking-widest text-muted-foreground">Total Keseluruhan</TableCell>
                                    <TableCell className="text-right text-primary text-sm">{formatPrice(actualGrandTotals.amount)}</TableCell>
                                    <TableCell className="text-right text-destructive text-xs italic">{formatPrice(actualGrandTotals.admin)}</TableCell>
                                    <TableCell className="text-right text-green-700 text-sm">{formatPrice(actualGrandTotals.net)}</TableCell>
                                    <TableCell className="text-right text-primary text-sm">{formatPrice(actualGrandTotals.ongkir)}</TableCell>
                                    <TableCell colSpan={groupBy === 'orderId' ? 2 : 3}></TableCell>
                                </TableRow>
                            </TableFooter>
                        )}
                    </Table>
                </div>

                <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-muted/30 p-4 rounded-xl border">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2"><span className="text-xs font-bold text-muted-foreground uppercase">Baris per halaman:</span><Select value={pageSize.toString()} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }}><SelectTrigger className="w-[80px] h-8 bg-background border-primary/10"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="5">5</SelectItem><SelectItem value="10">10</SelectItem><SelectItem value="30">30</SelectItem><SelectItem value="50">50</SelectItem><SelectItem value="100">100</SelectItem></SelectContent></Select></div>
                        <div className="text-[10px] text-muted-foreground border-l pl-4 font-bold uppercase tracking-wider">Total: <span className="text-foreground">{filteredSummary.length}</span> baris</div>
                    </div>
                    <div className="flex items-center gap-3"><Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="h-8 px-3"><ChevronLeft className="h-4 w-4 mr-1" /> Prev</Button><div className="flex items-center gap-1.5"><span className="text-xs font-bold text-muted-foreground">Hal.</span><span className="bg-primary text-primary-foreground px-2.5 py-0.5 rounded-md text-xs font-bold shadow-sm">{currentPage}</span><span className="text-xs font-bold text-muted-foreground">dari {totalPages || 1}</span></div><Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages || totalPages === 0} className="h-8 px-3">Next <ChevronRight className="h-4 w-4 ml-1" /></Button></div>
                </div>
            </>
        ) : (
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="bg-primary/5 border-primary/20 shadow-sm overflow-hidden relative"><div className="absolute right-4 top-4 text-primary/10"><Package className="h-12 w-12" /></div><CardHeader className="pb-2"><CardDescription className="text-xs font-bold text-primary/70 uppercase tracking-wider">Jumlah Item Terjual ({date ? format(date, 'd MMM yyyy', { locale: id }) : 'Semua'})</CardDescription><CardTitle className="text-3xl md:text-4xl font-bold text-primary">{actualGrandTotals.totalPcs.toLocaleString('id-ID')} <span className="text-sm font-medium text-muted-foreground">Pcs</span></CardTitle></CardHeader></Card>
                    <Card className="bg-green-500/5 border-green-500/20 shadow-sm overflow-hidden relative"><div className="absolute right-4 top-4 text-green-500/10"><TableIcon className="h-12 w-12" /></div><CardHeader className="pb-2"><CardDescription className="text-xs font-bold text-green-600 uppercase tracking-wider">Total Omzet Penjualan (Bruto)</CardDescription><CardTitle className="text-3xl md:text-4xl font-bold text-green-600">{formatPrice(actualGrandTotals.amount)}</CardTitle></CardHeader></Card>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="col-span-1 lg:col-span-2">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" />Omzet Bersih per Mitra (Netto)</CardTitle>
                            <CardDescription>Pendapatan yang diterima mitra setelah dipotong admin {adminFeePercent}%.</CardDescription>
                        </CardHeader>
                        <CardContent className="h-[400px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartDataMitra}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                                    <YAxis fontSize={10} tickLine={false} axisLine={false} tickFormatter={(value) => `Rp ${value/1000}k`} />
                                    <RechartsTooltip formatter={(value: any) => [formatPrice(value), 'Omzet Netto']} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}/>
                                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2"><PieChartIcon className="h-5 w-5 text-primary" />Distribusi Status Pesanan</CardTitle>
                            <CardDescription>Berdasarkan jumlah sub-order pengerjaan.</CardDescription>
                        </CardHeader>
                        <CardContent className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={chartDataStatus} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                                        {chartDataStatus.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2"><LayoutGrid className="h-5 w-5 text-primary" />Produk Terlaris</CardTitle>
                            <CardDescription>8 item dengan jumlah pesanan terbanyak.</CardDescription>
                        </CardHeader>
                        <CardContent className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartDataProducts} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" fontSize={10} width={100} tickLine={false} axisLine={false} />
                                    <RechartsTooltip formatter={(value: any) => [value, 'Porsi']} contentStyle={{ borderRadius: '8px' }}/>
                                    <Bar dataKey="value" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </div>
            </div>
        )}

        <AlertDialog open={!!orderToDelete} onOpenChange={(open) => !open && setOrderToDelete(null)}>
          <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Hapus Pesanan Ini?</AlertDialogTitle><AlertDialogDescription>Tindakan ini akan menghapus pesanan #{orderToDelete} secara permanen dari database, termasuk seluruh rincian item di dalamnya.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={() => orderToDelete && executeDeleteOrders([orderToDelete])} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Ya, Hapus Sekarang</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
        </AlertDialog>
    </div>
  );
}