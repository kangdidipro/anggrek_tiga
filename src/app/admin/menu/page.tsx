'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useDoc, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, doc, deleteDoc, setDoc, writeBatch, updateDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Plus, Pencil, Trash2, RefreshCcw, Search, X, FileUp, ArrowUpDown, ArrowUp, ArrowDown, RotateCcw, ChevronLeft, ChevronRight, PackageOpen, Tags, Image as ImageIcon, ImageOff, Info } from 'lucide-react';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
  
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedVendor, setSelectedVendor] = useState<string>('');

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [searchTerm, setSearchTerm] = useState('');
  const [nameFilter, setNameFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [vendorFilter, setVendorFilter] = useState('all');

  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'category', direction: 'asc' });

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const menuItemsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'menuItems');
  }, [firestore]);
  const { data: menuItems, isLoading } = useCollection<Product>(menuItemsQuery);

  const vendorsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'vendors');
  }, [firestore]);
  const { data: vendors, isLoading: isVendorsLoading } = useCollection<Vendor>(vendorsQuery);

  const dbCategoriesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'categories');
  }, [firestore]);
  const { data: dbCategories, isLoading: isCategoriesLoading } = useCollection<Category>(dbCategoriesQuery);

  const invDocRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'settings', 'inventory');
  }, [firestore]);
  const { data: inventorySettings } = useDoc<{ defaultStock: number }>(invDocRef);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, nameFilter, categoryFilter, vendorFilter]);

  const uniqueNames = useMemo(() => {
    if (!menuItems) return [];
    return Array.from(new Set(menuItems.map(i => i.name))).sort();
  }, [menuItems]);

  const filterCategories = useMemo(() => {
    const dbSet = new Set(dbCategories?.map(c => c.name.trim()) || []);
    const itemSet = new Set(menuItems?.map(i => i.category.trim()) || []);
    return Array.from(new Set([...dbSet, ...itemSet])).filter(Boolean).sort();
  }, [dbCategories, menuItems]);

  const uniqueVendors = useMemo(() => {
    if (!vendors) return [];
    return vendors.map(v => v.code).sort();
  }, [vendors]);

  useEffect(() => {
    if (isAdding) {
      setSelectedCategory('');
      setSelectedVendor('');
    } else if (isEditing) {
      setSelectedCategory(isEditing.category);
      setSelectedVendor(isEditing.vendor);
    }
  }, [isAdding, isEditing]);

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
      const matchesCategory = categoryFilter === 'all' || item.category.trim() === categoryFilter;
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

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredMenuItems.slice(start, start + pageSize);
  }, [filteredMenuItems, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredMenuItems.length / pageSize);

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
    const itemRef = doc(firestore, 'menuItems', id);
    
    deleteDoc(itemRef)
      .then(() => {
        toast({ title: "Berhasil", description: "Menu telah dihapus." });
        const newSelected = new Set(selectedIds);
        newSelected.delete(id);
        setSelectedIds(newSelected);
      })
      .catch(async (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: itemRef.path,
          operation: 'delete'
        }));
      });
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

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore) return;

    const formData = new FormData(e.currentTarget);
    const stockValue = Number(formData.get('stock'));
    
    // Ensure isActive is boolean, not undefined
    const isActiveValue = isEditing ? (isEditing.isActive !== false) : true;

    const productData: Product = {
      id: isEditing?.id || (Math.floor(Math.random() * 10000) + 1000).toString(),
      name: (formData.get('name')?.toString() || '').trim(),
      price: Number(formData.get('price')),
      sku: (formData.get('sku')?.toString() || '').trim(),
      category: selectedCategory.trim(),
      vendor: selectedVendor,
      stock: Math.max(0, stockValue),
      isActive: isActiveValue,
      imageUrl: (formData.get('imageUrl')?.toString() || '').trim(),
    };

    if (!productData.name || isNaN(productData.price) || !productData.sku || !productData.category || !productData.vendor) {
      toast({ variant: "destructive", title: "Data Tidak Lengkap", description: "Pastikan semua kolom bintang (*) telah diisi dengan benar." });
      return;
    }

    const itemRef = doc(firestore, 'menuItems', productData.id);
    
    setDoc(itemRef, productData, { merge: true })
      .then(() => {
        toast({ title: "Berhasil", description: "Menu telah disimpan." });
        setIsEditing(null);
        setIsAdding(false);
      })
      .catch(async (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: itemRef.path,
          operation: 'write',
          requestResourceData: productData
        }));
      });
  };

  const handleToggleStatus = async (id: string, isActive: boolean) => {
    if (!firestore) return;
    const itemRef = doc(firestore, 'menuItems', id);
    
    updateDoc(itemRef, { isActive })
      .then(() => {
        toast({
          title: "Status Diperbarui",
          description: `Menu kini dalam status ${isActive ? 'Aktif' : 'Tidak Tersedia'}.`,
        });
      })
      .catch(async (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: itemRef.path,
          operation: 'update',
          requestResourceData: { isActive }
        }));
      });
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
      const batch = writeBatch(firestore);
      for (const product of initialProducts) {
        const ref = doc(firestore, 'menuItems', product.id);
        batch.set(ref, { ...product, isActive: true });
      }
      await batch.commit();
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

        const batch = writeBatch(firestore);
        let importedCount = 0;

        for (const row of jsonData) {
          const name = row['Nama'] || row['Nama Menu'] || row['Name'];
          const price = Number(row['Harga'] || row['Price']);
          const sku = String(row['SKU'] || row['Kode Produk'] || '');
          const category = row['Kategori'] || row['Category'] || 'Nasi & Lauk';
          const stock = Number(row['Stok'] || row['Stock'] || 20);
          const vendor = row['Mitra'] || row['Vendor'] || (sku.includes('-') ? sku.split('-')[0] : '');
          const imageUrl = row['Foto'] || row['Image'] || row['URL Foto'] || '';

          if (name && price && sku) {
            const id = (Math.floor(Math.random() * 100000) + 10000).toString();
            const productData: Product = {
              id,
              name: String(name).trim(),
              price: price,
              sku: sku.trim(),
              category: String(category).trim(),
              vendor: String(vendor).trim(),
              stock: Math.max(0, stock),
              isActive: true,
              imageUrl: String(imageUrl).trim(),
            };
            batch.set(doc(firestore, 'menuItems', id), productData);
            importedCount++;
          }
        }

        await batch.commit();
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
          
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={isExcelImporting}>
                {isExcelImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
                Import Excel
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Import Menu via Excel</DialogTitle>
                <DialogDescription>
                  Unggah file .xlsx atau .xls dengan struktur kolom yang benar untuk menambah menu secara masal.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="bg-muted/30 p-4 rounded-lg border border-primary/10">
                  <h4 className="text-sm font-bold mb-2 uppercase tracking-tight">Struktur Kolom Wajib:</h4>
                  <ul className="text-xs space-y-1.5 list-disc pl-5 text-muted-foreground">
                    <li><strong>Nama</strong>: Nama menu (Contoh: Nasi Bakar)</li>
                    <li><strong>Harga</strong>: Angka saja (Contoh: 12000)</li>
                    <li><strong>SKU</strong>: Kode unik produk</li>
                    <li><strong>Kategori</strong>: Harus sesuai dengan Master Kategori</li>
                    <li><strong>Mitra</strong>: Kode singkat penjual (Contoh: NL)</li>
                    <li><strong>Foto</strong>: <u>Link / URL Gambar</u> (Google Drive, dll)</li>
                  </ul>
                </div>
                
                <Alert className="bg-orange-50 border-orange-200">
                  <Info className="h-4 w-4 text-orange-600" />
                  <AlertTitle className="text-xs font-bold text-orange-800 uppercase">Penting Tentang Gambar!</AlertTitle>
                  <AlertDescription className="text-[11px] text-orange-700 leading-relaxed">
                    Sistem <strong>TIDAK</strong> bisa membaca file gambar yang ditempel/copy-paste di dalam sel Excel. 
                    Anda harus menggunakan <strong>URL Link Gambar</strong> yang valid agar foto muncul di menu pelanggan.
                  </AlertDescription>
                </Alert>
              </div>
              <DialogFooter>
                <Button onClick={() => fileInputRef.current?.click()} className="w-full">
                  Pilih File & Import Sekarang
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
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
                    <Label htmlFor="name">Nama Menu *</Label>
                    <Input id="name" name="name" placeholder="Contoh: Nasi Bakar" required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="imageUrl">URL Foto Produk</Label>
                    <div className="relative">
                      <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="imageUrl" name="imageUrl" placeholder="https://image-url.com/foto.jpg" className="pl-10" />
                    </div>
                    <p className="text-[10px] text-muted-foreground italic">Kosongkan jika ingin menampilkan teks "Foto tidak tersedia".</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="price">Harga (Rp) *</Label>
                      <Input id="price" name="price" type="number" placeholder="12000" min="0" required />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="sku">SKU / Kode Produk *</Label>
                      <Input id="sku" name="sku" placeholder="NL-001" required />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="stock">Jumlah Stok *</Label>
                      <Input id="stock" name="stock" type="number" placeholder="20" defaultValue="20" min="0" required />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="category">Kategori *</Label>
                      <Select value={selectedCategory} onValueChange={setSelectedCategory} required>
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
                    <Label htmlFor="vendor">Mitra / Penjual *</Label>
                    <Select value={selectedVendor} onValueChange={setSelectedVendor} required>
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
                {filterCategories.map(cat => (
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
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {item.imageUrl ? (
                          <div className="h-8 w-8 rounded overflow-hidden bg-muted flex-shrink-0">
                            <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                          </div>
                        ) : (
                          <div className="h-8 w-8 rounded bg-muted flex items-center justify-center flex-shrink-0">
                            <ImageOff className="h-3 w-3 text-muted-foreground opacity-50" />
                          </div>
                        )}
                        {item.name}
                      </div>
                    </TableCell>
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
                                  <Label htmlFor="edit-name">Nama Menu *</Label>
                                  <Input id="edit-name" name="name" defaultValue={item.name} required />
                                </div>
                                <div className="grid gap-2">
                                  <Label htmlFor="edit-imageUrl">URL Foto Produk</Label>
                                  <div className="relative">
                                    <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input id="edit-imageUrl" name="imageUrl" defaultValue={item.imageUrl} placeholder="https://image-url.com/foto.jpg" className="pl-10" />
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="grid gap-2">
                                    <Label htmlFor="edit-price">Harga (Rp) *</Label>
                                    <Input id="edit-price" name="price" type="number" defaultValue={item.price} min="0" required />
                                  </div>
                                  <div className="grid gap-2">
                                    <Label htmlFor="edit-sku">SKU / Kode Produk *</Label>
                                    <Input id="edit-sku" name="sku" defaultValue={item.sku} required />
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="grid gap-2">
                                    <Label htmlFor="edit-stock">Jumlah Stok *</Label>
                                    <Input id="edit-stock" name="stock" type="number" defaultValue={Math.max(0, item.stock ?? 0)} min="0" required />
                                  </div>
                                  <div className="grid gap-2">
                                    <Label htmlFor="edit-category">Kategori *</Label>
                                    <Select value={selectedCategory} onValueChange={setSelectedCategory} required>
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
                                  <Label htmlFor="edit-vendor">Mitra / Penjual *</Label>
                                  <Select value={selectedVendor} onValueChange={setSelectedVendor} required>
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
