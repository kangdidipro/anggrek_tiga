
'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc, deleteDoc, setDoc, writeBatch, updateDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Plus, Pencil, Trash2, RefreshCcw, Search, X, FileUp, ArrowUpDown, ArrowUp, ArrowDown, RotateCcw, ChevronLeft, ChevronRight, PackageOpen, Tags } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { products as initialProducts } from '@/lib/products';
import type { Product, Vendor } from '@/lib/types';
import * as XLSX from 'xlsx';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface Category {
  id: string;
  name: string;
}

type SortConfig = {
  key: keyof Product | null;
  direction: 'asc' | 'desc';
};

export default function AdminMenuPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState<Product | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isExcelImporting, setIsExcelImporting] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isBulkUpdatingCategory, setIsBulkUpdatingCategory] = useState(false);
  const [newBulkCategory, setNewBulkCategory] = useState('');
  const [isUpdatingBulk, setIsUpdatingBulk] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Search and Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [nameFilter, setNameFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [vendorFilter, setVendorFilter] = useState('all');

  // Sorting State
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'category', direction: 'asc' });

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Fetch Menu Items
  const menuItemsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'menuItems');
  }, [firestore]);
  const { data: menuItems, isLoading } = useCollection<Product>(menuItemsQuery);

  // Fetch Vendors for Lookup
  const vendorsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'vendors');
  }, [firestore]);
  const { data: vendors, isLoading: isVendorsLoading } = useCollection<Vendor>(vendorsQuery);

  // Fetch Master Categories
  const dbCategoriesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'categories');
  }, [firestore]);
  const { data: dbCategories, isLoading: isCategoriesLoading } = useCollection<Category>(dbCategoriesQuery);

  // Fetch Inventory Settings for Reset
  const invDocRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'settings', 'inventory');
  }, [firestore]);
  const { data: inventorySettings } = useDoc<{ defaultStock: number }>(invDocRef);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, nameFilter, categoryFilter, vendorFilter]);

  // Unique values for dropdown filters (still useful for filtering existing items)
  const uniqueNames = useMemo(() => {
    if (!menuItems) return [];
    return Array.from(new Set(menuItems.map(i => i.name))).sort();
  }, [menuItems]);

  const uniqueCategories = useMemo(() => {
    if (!menuItems) return [];
    return Array.from(new Set(menuItems.map(i => i.category))).sort();
  }, [menuItems]);

  const uniqueVendors = useMemo(() => {
    if (!vendors) return [];
    return vendors.map(v => v.code).sort();
  }, [vendors]);

  // Handle Sort Toggle
  const handleSort = (key: keyof Product) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: keyof Product) => {
    if (sortConfig.key !== key) return <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />;
  };

  // Filtered and Sorted Menu Items Logic
  const filteredMenuItems = useMemo(() => {
    if (!menuItems) return [];
    
    const filtered = menuItems.filter((item) => {
      const search = searchTerm.toLowerCase();
      const matchesSearch = 
        item.name.toLowerCase().includes(search) ||
        item.category.toLowerCase().includes(search) ||
        item.sku.toLowerCase().includes(search) ||
        item.vendor.toLowerCase().includes(search);
      
      const matchesName = nameFilter === 'all' || item.name === nameFilter;
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
      const matchesVendor = vendorFilter === 'all' || item.vendor === vendorFilter;

      return matchesSearch && matchesName && matchesCategory && matchesVendor;
    });

    if (sortConfig.key) {
      filtered.sort((a, b) => {
        const valA = a[sortConfig.key!] ?? '';
        const valB = b[sortConfig.key!] ?? '';

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [menuItems, searchTerm, nameFilter, categoryFilter, vendorFilter, sortConfig]);

  // Paginated data
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredMenuItems.slice(start, start + pageSize);
  }, [filteredMenuItems, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredMenuItems.length / pageSize);

  // Selection Logic
  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedItems.map(item => item.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleDelete = async (id: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'menuItems', id));
      toast({ title: "Berhasil", description: "Menu telah dihapus." });
      const newSelected = new Set(selectedIds);
      newSelected.delete(id);
      setSelectedIds(newSelected);
    } catch (error) {
      toast({ variant: "destructive", title: "Gagal", description: "Tidak dapat menghapus menu." });
    }
  };

  const handleBulkDelete = async () => {
    if (!firestore || selectedIds.size === 0) return;
    setIsBulkDeleting(true);
    
    const batch = writeBatch(firestore);
    selectedIds.forEach(id => {
      batch.delete(doc(firestore, 'menuItems', id));
    });

    try {
      await batch.commit();
      toast({
        title: "Pembersihan Berhasil",
        description: `${selectedIds.size} menu telah dihapus selamanya.`,
      });
      setSelectedIds(new Set());
    } catch (error) {
      toast({ variant: 'destructive', title: 'Gagal', description: 'Terjadi kesalahan saat menghapus data.' });
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleBulkUpdateCategory = async () => {
    if (!firestore || selectedIds.size === 0 || !newBulkCategory) return;
    setIsUpdatingBulk(true);
    
    const batch = writeBatch(firestore);
    selectedIds.forEach(id => {
      batch.update(doc(firestore, 'menuItems', id), { category: newBulkCategory });
    });

    try {
      await batch.commit();
      toast({
        title: "Update Berhasil",
        description: `${selectedIds.size} menu telah dipindahkan ke kategori: ${newBulkCategory}`,
      });
      setSelectedIds(new Set());
      setIsBulkUpdatingCategory(false);
      setNewBulkCategory('');
    } catch (error) {
      toast({ variant: 'destructive', title: 'Gagal', description: 'Terjadi kesalahan saat memperbarui kategori.' });
    } finally {
      setIsUpdatingBulk(false);
    }
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore) return;

    const formData = new FormData(e.currentTarget);
    const stockValue = Number(formData.get('stock'));
    
    const productData: Product = {
      id: isEditing?.id || (Math.floor(Math.random() * 10000) + 1000).toString(),
      name: formData.get('name') as string,
      price: Number(formData.get('price')),
      sku: formData.get('sku') as string,
      category: formData.get('category') as string,
      vendor: formData.get('vendor') as string,
      stock: Math.max(0, stockValue),
      isActive: isEditing ? isEditing.isActive : true,
    };

    try {
      await setDoc(doc(firestore, 'menuItems', productData.id), productData, { merge: true });
      toast({ title: "Berhasil", description: "Menu telah disimpan." });
      setIsEditing(null);
      setIsAdding(false);
    } catch (error) {
      toast({ variant: "destructive", title: "Gagal", description: "Tidak dapat menyimpan menu." });
    }
  };

  const handleToggleStatus = async (id: string, isActive: boolean) => {
    if (!firestore) return;
    try {
      await updateDoc(doc(firestore, 'menuItems', id), { isActive });
      toast({
        title: "Status Diperbarui",
        description: `Menu kini dalam status ${isActive ? 'Tersedia' : 'Tidak Tersedia'}.`,
      });
    } catch (error) {
      toast({ variant: "destructive", title: "Gagal", description: "Gagal memperbarui status menu." });
    }
  };

  const handleResetStock = async () => {
    if (!firestore || !menuItems) return;
    setIsResetting(true);
    
    const defaultStockValue = inventorySettings?.defaultStock ?? 20;
    const batch = writeBatch(firestore);
    
    try {
      menuItems.forEach(item => {
        const itemRef = doc(firestore, 'menuItems', item.id);
        batch.update(itemRef, { stock: defaultStockValue });
      });
      
      await batch.commit();
      toast({
        title: "Stok Berhasil Direset",
        description: `Seluruh menu kini memiliki stok: ${defaultStockValue}`,
      });
    } catch (error) {
      toast({ variant: "destructive", title: "Gagal", description: "Tidak dapat mereset stok." });
    } finally {
      setIsResetting(false);
    }
  };

  const seedDefaultMenu = async () => {
    if (!firestore) return;
    setIsSeeding(true);
    try {
      for (const product of initialProducts) {
        await setDoc(doc(firestore, 'menuItems', product.id), { ...product, isActive: true });
      }
      toast({ title: "Berhasil", description: "Menu default telah diunggah." });
    } catch (error) {
      toast({ variant: "destructive", title: "Gagal", description: "Gagal mengunggah menu default." });
    } finally {
      setIsSeeding(false);
    }
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !firestore) return;

    setIsExcelImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

        let importedCount = 0;

        for (const row of jsonData) {
          const name = row['Nama'] || row['Nama Menu'] || row['Name'];
          const price = Number(row['Harga'] || row['Price']);
          const sku = String(row['SKU'] || row['Kode Produk'] || '');
          const category = row['Kategori'] || row['Category'] || 'Nasi & Lauk';
          const stock = Number(row['Stok'] || row['Stock'] || 20);
          const vendor = row['Mitra'] || row['Vendor'] || (sku.includes('-') ? sku.split('-')[0] : '');

          if (name && price && sku) {
            const productData: Product = {
              id: (Math.floor(Math.random() * 100000) + 10000).toString(),
              name: String(name),
              price: price,
              sku: sku,
              category: String(category),
              vendor: String(vendor),
              stock: Math.max(0, stock),
              isActive: true,
            };
            await setDoc(doc(firestore, 'menuItems', productData.id), productData);
            importedCount++;
          }
        }

        toast({
          title: "Import Selesai",
          description: `${importedCount} menu berhasil diimport.`,
        });
      } catch (error) {
        toast({ variant: "destructive", title: "Gagal Import", description: "Pastikan format file benar." });
      } finally {
        setIsExcelImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const resetFilters = () => {
    setSearchTerm('');
    setNameFilter('all');
    setCategoryFilter('all');
    setVendorFilter('all');
    setSortConfig({ key: 'category', direction: 'asc' });
    setCurrentPage(1);
  };

  if (isLoading || isVendorsLoading || isCategoriesLoading) {
    return <div className="flex h-full items-center justify-center p-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">Manajemen Menu</h1>
          <p className="text-muted-foreground">Tambah, ubah, atau hapus menu takjil yang tersedia.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            type="file"
            accept=".xlsx, .xls"
            className="hidden"
            ref={fileInputRef}
            onChange={handleExcelUpload}
          />
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isExcelImporting}>
            {isExcelImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
            Import Excel
          </Button>
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="border-orange-500 text-orange-600 hover:bg-orange-50" disabled={isResetting || !menuItems?.length}>
                {isResetting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                Reset Stok
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset Seluruh Stok?</AlertDialogTitle>
                <AlertDialogDescription>
                  Semua menu akan diatur ke angka stok default ({inventorySettings?.defaultStock ?? 20}) yang ada di menu Pengaturan. Tindakan ini tidak dapat dibatalkan.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction onClick={handleResetStock} className="bg-orange-600 hover:bg-orange-700">
                  Ya, Reset Semua
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {selectedIds.size > 0 && (
            <div className="flex gap-2">
              <Dialog open={isBulkUpdatingCategory} onOpenChange={setIsBulkUpdatingCategory}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="border-primary text-primary hover:bg-primary/5">
                    <Tags className="mr-2 h-4 w-4" />
                    Ubah Kategori ({selectedIds.size})
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[400px]">
                  <DialogHeader>
                    <DialogTitle>Ubah Kategori Masal</DialogTitle>
                    <DialogDescription>Pilih kategori baru untuk {selectedIds.size} menu yang dipilih.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="bulk-category">Pilih Kategori Baru</Label>
                      <Select value={newBulkCategory} onValueChange={setNewBulkCategory}>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih Kategori" />
                        </SelectTrigger>
                        <SelectContent>
                          {dbCategories && dbCategories.length > 0 ? (
                            dbCategories.map(cat => (
                              <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                            ))
                          ) : (
                            <SelectItem value="none" disabled>Belum ada kategori di Master Kategori</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setIsBulkUpdatingCategory(false)}>Batal</Button>
                    <Button onClick={handleBulkUpdateCategory} disabled={!newBulkCategory || isUpdatingBulk}>
                      {isUpdatingBulk ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Update Sekarang
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Hapus Terpilih ({selectedIds.size})
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Hapus {selectedIds.size} Menu?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Apakah Anda yakin ingin menghapus {selectedIds.size} menu yang dipilih? Tindakan ini permanen.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Batal</AlertDialogCancel>
                    <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive hover:bg-destructive/90">
                      {isBulkDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Hapus Sekarang
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}

          {(!menuItems || menuItems.length === 0) && (
            <Button variant="outline" size="sm" onClick={seedDefaultMenu} disabled={isSeeding}>
              {isSeeding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
              Menu Default
            </Button>
          )}
          <Dialog open={isAdding} onOpenChange={setIsAdding}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" /> Tambah Menu
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Tambah Menu Baru</DialogTitle>
                <DialogDescription>Masukkan detail menu takjil baru.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Nama Menu</Label>
                    <Input id="name" name="name" placeholder="Contoh: Nasi Bakar" required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="price">Harga (Rp)</Label>
                      <Input id="price" name="price" type="number" placeholder="12000" min="0" required />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="sku">SKU / Kode Produk</Label>
                      <Input id="sku" name="sku" placeholder="NL-001" required />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="stock">Jumlah Stok</Label>
                      <Input id="stock" name="stock" type="number" placeholder="20" defaultValue="20" min="0" required />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="category">Kategori</Label>
                      <Select name="category" required>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih Kategori" />
                        </SelectTrigger>
                        <SelectContent>
                          {dbCategories && dbCategories.length > 0 ? (
                            dbCategories.map(cat => (
                              <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                            ))
                          ) : (
                            <SelectItem value="none" disabled>Belum ada kategori</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="vendor">Mitra / Penjual</Label>
                    <Select name="vendor" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih Mitra" />
                      </SelectTrigger>
                      <SelectContent>
                        {vendors && vendors.length > 0 ? (
                          vendors.map((v) => (
                            <SelectItem key={v.id} value={v.code}>{v.name} ({v.code})</SelectItem>
                          ))
                        ) : (
                          <SelectItem value="none" disabled>Belum ada mitra</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" className="w-full">Simpan Menu</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="space-y-2 flex-1 min-w-[200px]">
            <Label className="text-xs uppercase text-muted-foreground font-bold">Cari Menu</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari kata kunci..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-2 w-[200px]">
            <Label className="text-xs uppercase text-muted-foreground font-bold">Filter Nama</Label>
            <Select value={nameFilter} onValueChange={setNameFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Semua Nama" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Nama</SelectItem>
                {uniqueNames.map(name => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 w-[180px]">
            <Label className="text-xs uppercase text-muted-foreground font-bold">Filter Kategori</Label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Semua Kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kategori</SelectItem>
                {uniqueCategories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 w-[150px]">
            <Label className="text-xs uppercase text-muted-foreground font-bold">Filter Mitra</Label>
            <Select value={vendorFilter} onValueChange={setVendorFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Semua Mitra" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Mitra</SelectItem>
                {uniqueVendors.map(code => (
                  <SelectItem key={code} value={code}>{code}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button variant="ghost" size="icon" onClick={resetFilters} title="Reset Filter" className="h-10 w-10">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <PackageOpen className="h-4 w-4" />
          <span>Total Records:</span>
          <span className="font-bold text-foreground bg-primary/10 px-2 py-0.5 rounded">{filteredMenuItems.length}</span>
          <span className="italic text-[10px]">(berdasarkan filter yang aktif)</span>
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <Checkbox 
                    checked={paginatedItems.length > 0 && selectedIds.size === paginatedItems.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead className="w-[60px]">No.</TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('name')}>
                  <div className="flex items-center">
                    Nama {getSortIcon('name')}
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('category')}>
                  <div className="flex items-center">
                    Kategori {getSortIcon('category')}
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('vendor')}>
                  <div className="flex items-center">
                    Mitra {getSortIcon('vendor')}
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('sku')}>
                  <div className="flex items-center">
                    SKU {getSortIcon('sku')}
                  </div>
                </TableHead>
                <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort('stock')}>
                  <div className="flex items-center justify-end">
                    Stok {getSortIcon('stock')}
                  </div>
                </TableHead>
                <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort('price')}>
                  <div className="flex items-center justify-end">
                    Harga {getSortIcon('price')}
                  </div>
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                    Tidak ada menu yang cocok.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedItems.map((item, index) => (
                  <TableRow key={item.id} className={selectedIds.has(item.id) ? "bg-muted/50" : ""}>
                    <TableCell>
                      <Checkbox 
                        checked={selectedIds.has(item.id)}
                        onCheckedChange={() => toggleSelect(item.id)}
                      />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {(currentPage - 1) * pageSize + index + 1}
                    </TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.category}</TableCell>
                    <TableCell className="font-mono text-xs font-bold">{item.vendor}</TableCell>
                    <TableCell>{item.sku}</TableCell>
                    <TableCell className={`text-right font-bold ${(item.stock ?? 0) <= 5 ? 'text-destructive' : ''}`}>
                      {Math.max(0, item.stock ?? 0)}
                    </TableCell>
                    <TableCell className="text-right">{formatPrice(item.price)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch 
                          checked={item.isActive !== false} 
                          onCheckedChange={(checked) => handleToggleStatus(item.id, checked)}
                        />
                        <span className={`text-[10px] font-bold uppercase ${item.isActive !== false ? 'text-green-600' : 'text-destructive'}`}>
                          {item.isActive !== false ? 'Aktif' : 'Non-Aktif'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Dialog open={isEditing?.id === item.id} onOpenChange={(open) => !open && setIsEditing(null)}>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => setIsEditing(item)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-[500px]">
                            <DialogHeader>
                              <DialogTitle>Edit Menu</DialogTitle>
                              <DialogDescription>Ubah detail menu takjil.</DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleSave} className="space-y-4">
                              <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                  <Label htmlFor="edit-name">Nama Menu</Label>
                                  <Input id="edit-name" name="name" defaultValue={item.name} required />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="grid gap-2">
                                    <Label htmlFor="edit-price">Harga (Rp)</Label>
                                    <Input id="edit-price" name="price" type="number" defaultValue={item.price} min="0" required />
                                  </div>
                                  <div className="grid gap-2">
                                    <Label htmlFor="edit-sku">SKU / Kode Produk</Label>
                                    <Input id="edit-sku" name="sku" defaultValue={item.sku} required />
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="grid gap-2">
                                    <Label htmlFor="edit-stock">Jumlah Stok</Label>
                                    <Input id="edit-stock" name="stock" type="number" defaultValue={Math.max(0, item.stock ?? 0)} min="0" required />
                                  </div>
                                  <div className="grid gap-2">
                                    <Label htmlFor="edit-category">Kategori</Label>
                                    <Select name="category" defaultValue={item.category} required>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Pilih Kategori" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {dbCategories && dbCategories.length > 0 ? (
                                          dbCategories.map(cat => (
                                            <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                                          ))
                                        ) : (
                                          <SelectItem value="none" disabled>Belum ada kategori</SelectItem>
                                        )}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                                <div className="grid gap-2">
                                  <Label htmlFor="edit-vendor">Mitra / Penjual</Label>
                                  <Select name="vendor" defaultValue={item.vendor} required>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Pilih Mitra" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {vendors && vendors.length > 0 ? (
                                        vendors.map((v) => (
                                          <SelectItem key={v.id} value={v.code}>{v.name} ({v.code})</SelectItem>
                                        ))
                                      ) : (
                                        <SelectItem value="none" disabled>Belum ada mitra</SelectItem>
                                      )}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              <DialogFooter>
                                <Button type="submit" className="w-full">Simpan Perubahan</Button>
                              </DialogFooter>
                            </form>
                          </DialogContent>
                        </Dialog>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(item.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-card p-4 rounded-lg border shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Tampilkan</span>
            <Select value={pageSize.toString()} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }}>
              <SelectTrigger className="w-[80px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="1000">1000</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">data per halaman</span>
          </div>
          <div className="text-sm text-muted-foreground border-l pl-4">
            Filter: <span className="font-bold text-foreground">{filteredMenuItems.length}</span> / Total: <span className="font-bold text-foreground">{menuItems?.length || 0}</span> item
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> Prev
          </Button>
          <div className="flex items-center gap-1 px-2">
            <span className="text-sm font-medium">Halaman</span>
            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-sm font-bold">{currentPage}</span>
            <span className="text-sm font-medium">dari {totalPages || 1}</span>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages || totalPages === 0}
          >
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
