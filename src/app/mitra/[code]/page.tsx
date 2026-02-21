'use client';

import { useEffect, useState, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useUser, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collectionGroup, getDocs, query, collection, where, doc, updateDoc, arrayUnion, setDoc, deleteDoc } from 'firebase/firestore';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Loader2, CalendarIcon, ShoppingBag, Clock, CheckCircle2, Printer, Calculator, Banknote, UtensilsCrossed, ListOrdered, Pencil, Trash2, Plus, ImageIcon, ImageOff, X, Save, Tag } from 'lucide-react';
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
import type { Vendor, Product } from '@/lib/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

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
  vendor: string;
}

interface Order {
  id: string;
  customerId: string;
  orderDateTime: string;
  totalAmount: number;
  paymentMethod: 'QRIS' | 'COD';
  vendorStatuses: Record<string, { status: string; statusHistory: StatusLog[] }>;
  deliveryAddress: string;
  items: OrderItem[];
}

interface Category {
  id: string;
  name: string;
}

const STATUS_FLOWS = {
  QRIS: ["Dipesan", "Dibayar", "Diproses", "Dikumpulkan", "Dikirim", "Dibatalkan"],
  COD: ["Dipesan", "Diproses", "Dikumpulkan", "Dikirim dan Bayar", "Dibatalkan"]
};

const MITRA_AUTHORITY_STATUSES = ["Diproses", "Dikumpulkan", "Dibatalkan"];

export default function MitraOrderPage() {
  const params = useParams();
  const code = params.code as string;
  const firestore = useFirestore();
  const { user, isUserLoading: isAuthLoading } = useUser();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<string | null>(null);
  const { toast } = useToast();

  // Product Management State
  const [isEditingProduct, setIsEditingProduct] = useState<Product | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [isSavingProduct, setIsSavingProduct] = useState(false);

  // Fetch Mitra Info
  const vendorsQuery = useMemoFirebase(() => {
    if (!firestore || !code) return null;
    return query(collection(firestore, 'vendors'), where('code', '==', code));
  }, [firestore, code]);
  const { data: vendorInfo, isLoading: isVendorLoading } = useCollection<Vendor>(vendorsQuery);

  // Fetch Products for this Mitra
  const mitraProductsQuery = useMemoFirebase(() => {
    if (!firestore || !code) return null;
    return query(collection(firestore, 'menuItems'), where('vendor', '==', code));
  }, [firestore, code]);
  const { data: mitraProducts, isLoading: isProductsLoading } = useCollection<Product>(mitraProductsQuery);

  // Fetch Categories for Edit Form
  const categoriesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'categories');
  }, [firestore]);
  const { data: categories } = useCollection<Category>(categoriesQuery);

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
        
        const ordersWithItems: Order[] = ordersData.map(order => ({
            ...order,
            items: orderItemsData.filter(item => item.orderId === order.id && item.vendor === code)
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

  const financialSummary = useMemo(() => {
    const bruto = filteredOrders.reduce((acc, order) => 
      acc + order.items.reduce((sum, item) => sum + (item.quantity * item.priceAtOrder), 0), 0
    );
    const admin = bruto * 0.10;
    const netto = bruto - admin;
    return { bruto, admin, netto };
  }, [filteredOrders]);

  const handleUpdateStatus = async (order: Order, newStatus: string) => {
    if (!firestore || isUpdatingStatus) return;
    setIsUpdatingStatus(order.id);

    const now = new Date().toISOString();
    const orderRef = doc(firestore, 'customers', order.customerId, 'orders', order.id);
    const updateData = {
      [`vendorStatuses.${code}.status`]: newStatus,
      [`vendorStatuses.${code}.statusHistory`]: arrayUnion({ status: newStatus, timestamp: now })
    };

    updateDoc(orderRef, updateData)
      .then(() => {
        setOrders(prev => prev.map(o => {
          if (o.id === order.id) {
            const updatedVendorStatuses = { ...o.vendorStatuses };
            updatedVendorStatuses[code] = {
              status: newStatus,
              statusHistory: [...(updatedVendorStatuses[code]?.statusHistory || []), { status: newStatus, timestamp: now }]
            };
            return { ...o, vendorStatuses: updatedVendorStatuses };
          }
          return o;
        }));
        toast({ title: "Status Diperbarui", description: `Pesanan #${order.id}-${code} sekarang: ${newStatus}` });
      })
      .catch(async (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: orderRef.path, operation: 'update', requestResourceData: updateData }));
      })
      .finally(() => {
        setIsUpdatingStatus(null);
      });
  };

  // Product Management Logic
  const handleEditProduct = (product: Product) => {
    setIsEditingProduct(product);
    setPreviewUrl(product.imageUrl || '');
    setSelectedCategory(product.category || '');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 800000) {
      toast({ variant: "destructive", title: "File Terlalu Besar", description: "Maksimal ukuran foto adalah 800KB." });
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => { setPreviewUrl(reader.result as string); };
    reader.readAsDataURL(file);
  };

  const handleSaveProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !isEditingProduct) return;

    setIsSavingProduct(true);
    const formData = new FormData(e.currentTarget);
    
    const productData: Product = {
      ...isEditingProduct,
      name: (formData.get('name') as string).trim(),
      price: Number(formData.get('price')),
      sku: (formData.get('sku') as string).trim(),
      stock: Math.max(0, Number(formData.get('stock'))),
      category: selectedCategory,
      imageUrl: previewUrl,
      isActive: isEditingProduct.isActive !== false
    };

    const itemRef = doc(firestore, 'menuItems', productData.id);
    setDoc(itemRef, productData, { merge: true })
      .then(() => {
        toast({ title: "Menu Diperbarui", description: "Perubahan pada menu telah disimpan." });
        setIsEditingProduct(null);
      })
      .catch(error => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: itemRef.path, operation: 'write', requestResourceData: productData }));
      })
      .finally(() => setIsSavingProduct(false));
  };

  const handleToggleProductStatus = async (product: Product, isActive: boolean) => {
    if (!firestore) return;
    const itemRef = doc(firestore, 'menuItems', product.id);
    updateDoc(itemRef, { isActive })
      .then(() => {
        toast({ title: "Status Diperbarui", description: `Menu ${product.name} sekarang ${isActive ? 'Aktif' : 'Non-Aktif'}` });
      })
      .catch(error => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: itemRef.path, operation: 'update', requestResourceData: { isActive } }));
      });
  };

  const handlePrintReceipt = async (order: Order) => {
    const docPdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [80, 250] });
    const centerPos = 40;
    let y = 10;
    const itemsToPrint = order.items;
    const bruto = itemsToPrint.reduce((sum, item) => sum + (item.priceAtOrder * item.quantity), 0);
    const admin = bruto * 0.10;
    const netto = bruto - admin;

    docPdf.setFontSize(12);
    docPdf.text("TAKJILKU", centerPos, y, { align: 'center' });
    y += 4;
    docPdf.setFontSize(8);
    docPdf.text("Ramadhan UMKM RW06", centerPos, y, { align: 'center' });
    y += 4;
    docPdf.setFontSize(9);
    docPdf.text(`SLIP MITRA: ${code}`, centerPos, y, { align: 'center' });
    y += 4;
    docPdf.setFontSize(8);
    docPdf.text(`ID SUB-ORDER: ${order.id}-${code}`, centerPos, y, { align: 'center' });
    y += 10;
    docPdf.text(`Tgl: ${format(new Date(order.orderDateTime), 'dd/MM/yyyy HH:mm')}`, 5, y);
    docPdf.text(`Bayar: ${order.paymentMethod}`, 5, y + 4);
    docPdf.text("-".repeat(40), centerPos, y + 8, { align: 'center' });
    y += 14;
    itemsToPrint.forEach((item) => {
      docPdf.text(`${item.name}`, 5, y);
      docPdf.text(`${item.quantity} x ${formatPrice(item.priceAtOrder)}`, 5, y + 4);
      docPdf.text(`${formatPrice(item.priceAtOrder * item.quantity)}`, 75, y + 4, { align: 'right' });
      y += 10;
    });
    docPdf.text("-".repeat(40), centerPos, y, { align: 'center' });
    y += 6;
    docPdf.setFontSize(10);
    docPdf.text("NETTO DITERIMA:", 5, y);
    docPdf.text(`${formatPrice(netto)}`, 75, y, { align: 'right' });
    docPdf.save(`slip_${order.id}_${code}.pdf`);
  };

  if (isLoading || isVendorLoading || isAuthLoading || isProductsLoading) {
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

      <Tabs defaultValue="orders" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 max-w-md bg-primary/10 p-1">
          <TabsTrigger value="orders" className="flex items-center gap-2">
            <ListOrdered className="h-4 w-4" />
            Order Saya
          </TabsTrigger>
          <TabsTrigger value="menu" className="flex items-center gap-2">
            <UtensilsCrossed className="h-4 w-4" />
            Atur Menu
          </TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4 text-center">
                <p className="text-xs font-bold text-muted-foreground uppercase mb-1">Total Pesanan</p>
                <p className="text-2xl font-bold text-primary">{filteredOrders.length}</p>
              </CardContent>
            </Card>
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4 text-center">
                <p className="text-xs font-bold text-muted-foreground uppercase mb-1">Omzet Bruto</p>
                <p className="text-2xl font-bold text-primary">{formatPrice(financialSummary.bruto)}</p>
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
                const orderAdmin = orderBruto * 0.10;
                const orderNetto = orderBruto - orderAdmin;
                const vStatus = order.vendorStatuses?.[code] || { status: 'Dipesan', statusHistory: [] };
                const flow = STATUS_FLOWS[order.paymentMethod];
                const mitraOptions = flow.filter(s => MITRA_AUTHORITY_STATUSES.includes(s) || s === vStatus.status);

                return (
                  <AccordionItem value={order.id} key={order.id} className="border-b-0">
                    <Card className="shadow-sm overflow-hidden border-primary/10">
                      <CardHeader className="p-4">
                        <AccordionTrigger className="w-full p-0 hover:no-underline">
                          <div className="flex justify-between items-center w-full">
                            <div className="text-left">
                              <CardTitle className="text-base md:text-lg">Order #{order.id}-{code}</CardTitle>
                              <CardDescription className="text-xs md:text-sm">
                                {format(new Date(order.orderDateTime), 'HH:mm')} WIB | {order.paymentMethod}
                              </CardDescription>
                            </div>
                            <div className="text-right flex flex-col items-end gap-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-muted-foreground font-bold">NETTO:</span>
                                <p className="font-bold text-base md:text-lg text-green-600">{formatPrice(orderNetto)}</p>
                              </div>
                              <Badge className={getStatusBadgeColor(vStatus.status)}>{vStatus.status}</Badge>
                            </div>
                          </div>
                        </AccordionTrigger>
                      </CardHeader>
                      <AccordionContent>
                        <CardContent className="p-4 pt-0 space-y-6">
                          <div className="border-t pt-4">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                              <div className="flex-1 w-full max-w-xs">
                                <label className="text-xs font-bold text-muted-foreground block mb-2 uppercase tracking-tighter">Ubah Status Pengerjaan Mitra:</label>
                                <Select disabled={isUpdatingStatus === order.id} value={vStatus.status} onValueChange={(val) => handleUpdateStatus(order, val)}>
                                  <SelectTrigger className="border-primary/20"><SelectValue /></SelectTrigger>
                                  <SelectContent>{mitraOptions.map(s => (<SelectItem key={s} value={s}>{s}</SelectItem>))}</SelectContent>
                                </Select>
                              </div>
                              <Button variant="outline" size="sm" onClick={() => handlePrintReceipt(order)} className="shrink-0 border-primary/30">
                                <Printer className="h-4 w-4 mr-2" /> Cetak Slip
                              </Button>
                            </div>
                          </div>
                          <div className="border-t pt-4">
                            <h4 className="font-semibold mb-2 text-sm text-muted-foreground uppercase tracking-wider">Item Pesanan:</h4>
                            <div className="space-y-2 pt-2">
                              {order.items.map(item => (
                                <div key={item.id} className="flex justify-between text-sm bg-muted/30 p-2 rounded">
                                  <div><span className="font-medium">{item.name}</span><span className="text-muted-foreground"> x {item.quantity}</span></div>
                                  <span className="font-bold">{formatPrice(item.priceAtOrder * item.quantity)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="border-t pt-4">
                            <h4 className="font-semibold mb-2 text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2"><Clock className="h-4 w-4" /> Alamat Pengiriman:</h4>
                            <p className="text-sm p-3 bg-primary/5 rounded border border-primary/10 italic">{order.deliveryAddress}</p>
                          </div>
                        </CardContent>
                      </AccordionContent>
                    </Card>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </TabsContent>

        <TabsContent value="menu" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Daftar Menu Saya</CardTitle>
                <CardDescription>Kelola stok dan harga menu Anda yang muncul di pelanggan.</CardDescription>
              </div>
              <Badge variant="outline" className="h-6">Total: {mitraProducts?.length || 0} Menu</Badge>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Foto</TableHead>
                    <TableHead>Nama Menu</TableHead>
                    <TableHead className="text-right">Harga</TableHead>
                    <TableHead className="text-right">Stok</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mitraProducts?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">Belum ada menu yang terdaftar untuk mitra Anda.</TableCell>
                    </TableRow>
                  ) : (
                    mitraProducts?.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell>
                          {product.imageUrl ? (
                            <img src={product.imageUrl} alt={product.name} className="h-10 w-10 object-cover rounded border" />
                          ) : (
                            <div className="h-10 w-10 rounded border bg-muted flex items-center justify-center"><ImageOff className="h-4 w-4 opacity-20" /></div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          {product.name}
                          <div className="text-[10px] text-muted-foreground uppercase font-mono mt-0.5">{product.sku}</div>
                        </TableCell>
                        <TableCell className="text-right font-bold text-primary">{formatPrice(product.price)}</TableCell>
                        <TableCell className={`text-right font-bold ${product.stock <= 5 ? 'text-destructive' : ''}`}>{product.stock}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch 
                              checked={product.isActive !== false} 
                              onCheckedChange={(checked) => handleToggleProductStatus(product, checked)}
                            />
                            <span className={`text-[10px] font-bold uppercase ${product.isActive !== false ? 'text-green-600' : 'text-destructive'}`}>
                              {product.isActive !== false ? 'Aktif' : 'Off'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Dialog open={isEditingProduct?.id === product.id} onOpenChange={(open) => !open && setIsEditingProduct(null)}>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => handleEditProduct(product)}><Pencil className="h-4 w-4" /></Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[500px]">
                              <DialogHeader>
                                <DialogTitle>Edit Menu Mitra</DialogTitle>
                                <DialogDescription>Ubah rincian menu yang tampil di aplikasi.</DialogDescription>
                              </DialogHeader>
                              <form onSubmit={handleSaveProduct} className="space-y-4">
                                <div className="grid gap-4 py-4">
                                  <div className="grid gap-2">
                                    <Label htmlFor="name">Nama Menu *</Label>
                                    <Input id="name" name="name" defaultValue={isEditingProduct?.name} required />
                                  </div>
                                  <div className="grid gap-2">
                                    <Label>Foto Produk</Label>
                                    <div className="relative h-32 w-full rounded-md border-2 border-dashed border-muted-foreground/25 bg-muted/50 flex flex-col items-center justify-center overflow-hidden">
                                      {previewUrl ? (
                                        <><img src={previewUrl} alt="Preview" className="h-full w-full object-contain" /><Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2 h-6 w-6" onClick={() => setPreviewUrl('')}><X className="h-3 w-3" /></Button></>
                                      ) : (
                                        <div className="flex flex-col items-center gap-1 text-muted-foreground text-center">
                                          <ImageIcon className="h-8 w-8 opacity-50" />
                                          <p className="text-[10px] font-bold">Klik untuk Upload Foto</p>
                                        </div>
                                      )}
                                      <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileChange} />
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2"><Label htmlFor="price">Harga (Rp) *</Label><Input id="price" name="price" type="number" defaultValue={isEditingProduct?.price} required /></div>
                                    <div className="grid gap-2"><Label htmlFor="sku">SKU / Kode *</Label><Input id="sku" name="sku" defaultValue={isEditingProduct?.sku} required /></div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2"><Label htmlFor="stock">Stok *</Label><Input id="stock" name="stock" type="number" defaultValue={isEditingProduct?.stock} required /></div>
                                    <div className="grid gap-2">
                                      <Label htmlFor="category">Kategori *</Label>
                                      <Select value={selectedCategory} onValueChange={setSelectedCategory} required>
                                        <SelectTrigger><SelectValue placeholder="Pilih Kategori" /></SelectTrigger>
                                        <SelectContent>
                                          {categories?.map(cat => (<SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button type="submit" className="w-full" disabled={isSavingProduct}>
                                    {isSavingProduct && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Simpan Perubahan
                                  </Button>
                                </DialogFooter>
                              </form>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
