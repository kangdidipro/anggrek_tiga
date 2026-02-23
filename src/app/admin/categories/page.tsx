
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, deleteDoc, setDoc, writeBatch } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Plus, Pencil, Trash2, Search, Tag, RefreshCcw, Eraser, AlertCircle, CheckCircle2, CheckSquare, Layers } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { products as initialProducts } from '@/lib/products';
import type { Product } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Category {
  id: string;
  name: string;
  group?: string;
}

interface DisplayCategory extends Category {
  isFromDb: boolean;
  itemCount: number;
}

const CATEGORY_GROUPS = [
  { value: 'Makanan Utama/Berat', description: 'Nasi goreng, ayam geprek, mie, dll.' },
  { value: 'Minuman & Es Krim', description: 'Kopi, jus, bubble tea, es teh.' },
  { value: 'Snack/Camilan', description: 'Makanan ringan.' },
];

export default function AdminCategoriesPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState<Category | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isBulkRegistering, setIsBulkRegistering] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedGroup, setSelectedGroup] = useState<string>('');

  // Fetch Categories from DB
  const categoriesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'categories');
  }, [firestore]);
  const { data: categories, isLoading } = useCollection<Category>(categoriesQuery);

  // Fetch Menu Items to calculate usage
  const menuItemsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'menuItems');
  }, [firestore]);
  const { data: menuItems, isLoading: isItemsLoading } = useCollection<Product>(menuItemsQuery);

  useEffect(() => {
    if (isEditing) {
      setSelectedGroup(isEditing.group || '');
    } else if (isAdding) {
      setSelectedGroup('');
    }
  }, [isEditing, isAdding]);

  // Calculate usage per category with robust matching (trimmed)
  const categoryUsage = useMemo(() => {
    const counts: Record<string, number> = {};
    menuItems?.forEach(item => {
      const catName = (item.category || 'Tanpa Kategori').trim();
      counts[catName] = (counts[catName] || 0) + 1;
    });
    return counts;
  }, [menuItems]);

  const displayCategories = useMemo((): DisplayCategory[] => {
    const dbCatNames = new Set(categories?.map(c => c.name.trim().toLowerCase()) || []);
    const itemCatNames = Object.keys(categoryUsage);
    
    const list: DisplayCategory[] = (categories || []).map(c => ({
      ...c,
      isFromDb: true,
      itemCount: categoryUsage[c.name.trim()] || 0
    }));
    
    // Add "orphan" categories found in products but missing from DB
    itemCatNames.forEach(name => {
      if (name && !dbCatNames.has(name.trim().toLowerCase())) {
        list.push({
          id: `missing-${name}`,
          name: name,
          isFromDb: false,
          itemCount: categoryUsage[name] || 0
        });
      }
    });

    return list.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.group && c.group.toLowerCase().includes(searchTerm.toLowerCase()))
    ).sort((a, b) => a.name.localeCompare(b.name));
  }, [categories, categoryUsage, searchTerm]);

  // Orphans currently visible
  const orphanIds = useMemo(() => 
    new Set(displayCategories.filter(c => !c.isFromDb).map(c => c.id)),
    [displayCategories]
  );

  const toggleSelectAll = () => {
    if (selectedIds.size === orphanIds.size && orphanIds.size > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(orphanIds));
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
      await deleteDoc(doc(firestore, 'categories', id));
      toast({ title: "Berhasil", description: "Kategori telah dihapus." });
    } catch (error) {
      toast({ variant: "destructive", title: "Gagal", description: "Tidak dapat menghapus kategori." });
    }
  };

  const handleRegisterOrphan = async (name: string) => {
    if (!firestore) return;
    const id = (Math.floor(Math.random() * 10000) + 1000).toString();
    try {
      await setDoc(doc(firestore, 'categories', id), { id, name });
      toast({ title: "Berhasil", description: `Kategori "${name}" telah didaftarkan ke Master.` });
    } catch (error) {
      toast({ variant: "destructive", title: "Gagal", description: "Gagal mendaftarkan kategori." });
    }
  };

  const handleBulkRegister = async () => {
    if (!firestore || selectedIds.size === 0) return;
    setIsBulkRegistering(true);
    try {
      const batch = writeBatch(firestore);
      selectedIds.forEach(id => {
        const cat = displayCategories.find(c => c.id === id);
        if (cat && !cat.isFromDb) {
          const newId = (Math.floor(Math.random() * 10000) + 1000).toString();
          batch.set(doc(firestore, 'categories', newId), { id: newId, name: cat.name });
        }
      });
      await batch.commit();
      toast({ title: "Berhasil", description: `${selectedIds.size} kategori baru telah didaftarkan.` });
      setSelectedIds(new Set());
    } catch (error) {
      toast({ variant: "destructive", title: "Gagal", description: "Gagal mendaftarkan kategori secara masal." });
    } finally {
      setIsBulkRegistering(false);
    }
  };

  const handleClearUnused = async () => {
    if (!firestore || !categories) return;
    setIsSeeding(true);
    try {
      const batch = writeBatch(firestore);
      let removedCount = 0;
      
      categories.forEach(cat => {
        const count = categoryUsage[cat.name.trim()] || 0;
        if (count === 0) {
          batch.delete(doc(firestore, 'categories', cat.id));
          removedCount++;
        }
      });

      if (removedCount > 0) {
        await batch.commit();
        toast({ title: "Berhasil", description: `${removedCount} kategori kosong telah dihapus.` });
      } else {
        toast({ title: "Info", description: "Tidak ada kategori kosong untuk dihapus." });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Gagal", description: "Gagal membersihkan kategori." });
    } finally {
      setIsSeeding(false);
    }
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore) return;

    const formData = new FormData(e.currentTarget);
    const categoryName = (formData.get('name') as string).trim();
    
    const categoryData: Category = {
      id: isEditing?.id || (Math.floor(Math.random() * 10000) + 1000).toString(),
      name: categoryName,
      group: selectedGroup,
    };

    try {
      await setDoc(doc(firestore, 'categories', categoryData.id), categoryData, { merge: true });
      toast({ title: "Berhasil", description: "Kategori telah disimpan." });
      setIsEditing(null);
      setIsAdding(false);
    } catch (error) {
      toast({ variant: "destructive", title: "Gagal", description: "Tidak dapat menyimpan kategori." });
    }
  };

  const handleSeedCategories = async () => {
    if (!firestore) return;
    setIsSeeding(true);
    try {
      const uniqueCategories = Array.from(new Set(initialProducts.map(p => p.category.trim())));
      const batch = writeBatch(firestore);
      
      uniqueCategories.forEach((catName, index) => {
        const id = (index + 101).toString();
        const catRef = doc(firestore, 'categories', id);
        batch.set(catRef, { id, name: catName });
      });

      await batch.commit();
      toast({ title: "Berhasil", description: `${uniqueCategories.length} kategori default telah ditambahkan.` });
    } catch (error) {
      toast({ variant: "destructive", title: "Gagal", description: "Gagal memproses kategori default." });
    } finally {
      setIsSeeding(false);
    }
  };

  if (isLoading || isItemsLoading) {
    return <div className="flex h-full items-center justify-center p-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">Master Kategori</h1>
          <p className="text-muted-foreground">Kelola daftar kategori menu takjil.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {selectedIds.size > 0 && (
            <Button 
              variant="default" 
              size="sm" 
              onClick={handleBulkRegister} 
              disabled={isBulkRegistering}
              className="bg-orange-600 hover:bg-orange-700 shadow-sm animate-in fade-in slide-in-from-right-2"
            >
              {isBulkRegistering ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckSquare className="mr-2 h-4 w-4" />}
              Daftarkan Terpilih ({selectedIds.size})
            </Button>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleClearUnused} 
            disabled={isSeeding || !categories?.length}
            className="border-destructive/20 text-destructive hover:bg-destructive/5"
          >
            {isSeeding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eraser className="mr-2 h-4 w-4" />}
            Bersihkan yang Kosong
          </Button>
          {(!categories || categories.length === 0) && (
            <Button variant="outline" size="sm" onClick={handleSeedCategories} disabled={isSeeding}>
              {isSeeding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
              Ambil dari Menu
            </Button>
          )}
          <Dialog open={isAdding} onOpenChange={setIsAdding}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" /> Tambah Kategori
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Tambah Kategori Baru</DialogTitle>
                <DialogDescription>Masukkan nama kategori dan pilih grup kategori.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Nama Kategori</Label>
                    <Input id="name" name="name" placeholder="Contoh: Nasi & Lauk" required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="group">Grup Kategori</Label>
                    <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih Grup" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORY_GROUPS.map((group) => (
                          <SelectItem key={group.value} value={group.value}>
                            <div className="flex flex-col text-left">
                              <span className="font-bold text-sm">{group.value}</span>
                              <span className="text-[10px] text-muted-foreground whitespace-normal leading-tight">{group.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" className="w-full">Simpan Kategori</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cari kategori atau grup..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <Card>
        <CardContent className="p-0 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <Checkbox 
                    checked={orphanIds.size > 0 && selectedIds.size === orphanIds.size}
                    onCheckedChange={toggleSelectAll}
                    disabled={orphanIds.size === 0}
                  />
                </TableHead>
                <TableHead className="w-[60px]">No.</TableHead>
                <TableHead>Nama Kategori</TableHead>
                <TableHead>Grup Kategori</TableHead>
                <TableHead className="text-center">Jumlah Menu</TableHead>
                <TableHead>Status Master</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayCategories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    Belum ada kategori. {(!categories || categories.length === 0) && "Klik 'Ambil dari Menu' untuk memulai."}
                  </TableCell>
                </TableRow>
              ) : (
                displayCategories.map((category, index) => {
                  return (
                    <TableRow key={category.id} className={!category.isFromDb ? "bg-destructive/5" : ""}>
                      <TableCell>
                        {!category.isFromDb && (
                          <Checkbox 
                            checked={selectedIds.has(category.id)}
                            onCheckedChange={() => toggleSelect(category.id)}
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">{index + 1}</TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Tag className="h-4 w-4 text-primary/70" />
                          {category.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        {category.group ? (
                          <div className="flex items-center gap-1.5">
                            <Layers className="h-3 w-3 text-muted-foreground" />
                            <Badge variant="secondary" className="font-normal text-[10px] bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-50">
                              {category.group}
                            </Badge>
                          </div>
                        ) : (
                          <span className="text-[10px] text-muted-foreground italic">Belum diset</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full text-xs font-bold ${category.itemCount > 0 ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}>
                          {category.itemCount}
                        </span>
                      </TableCell>
                      <TableCell>
                        {category.isFromDb ? (
                          <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 gap-1 text-[10px]">
                            <CheckCircle2 className="h-3 w-3" /> Terdaftar
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1 animate-pulse text-[10px]">
                            <AlertCircle className="h-3 w-3" /> Belum Terdaftar
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {!category.isFromDb ? (
                            <Button 
                              size="sm" 
                              variant="secondary" 
                              className="h-8 text-xs font-bold"
                              onClick={() => handleRegisterOrphan(category.name)}
                            >
                              Daftarkan
                            </Button>
                          ) : (
                            <>
                              <Dialog open={isEditing?.id === category.id} onOpenChange={(open) => !open && setIsEditing(null)}>
                                <DialogTrigger asChild>
                                  <Button variant="ghost" size="icon" onClick={() => setIsEditing(category)}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-[425px]">
                                  <DialogHeader>
                                    <DialogTitle>Edit Kategori</DialogTitle>
                                    <DialogDescription>Ubah rincian kategori.</DialogDescription>
                                  </DialogHeader>
                                  <form onSubmit={handleSave} className="space-y-4">
                                    <div className="grid gap-4 py-4">
                                      <div className="grid gap-2">
                                        <Label htmlFor="edit-name">Nama Kategori</Label>
                                        <Input id="edit-name" name="name" defaultValue={category.name} required />
                                      </div>
                                      <div className="grid gap-2">
                                        <Label htmlFor="edit-group">Grup Kategori</Label>
                                        <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                                          <SelectTrigger>
                                            <SelectValue placeholder="Pilih Grup" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {CATEGORY_GROUPS.map((group) => (
                                              <SelectItem key={group.value} value={group.value}>
                                                <div className="flex flex-col text-left">
                                                  <span className="font-bold text-sm">{group.value}</span>
                                                  <span className="text-[10px] text-muted-foreground whitespace-normal leading-tight">{group.description}</span>
                                                </div>
                                              </SelectItem>
                                            ))}
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
                              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(category.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
