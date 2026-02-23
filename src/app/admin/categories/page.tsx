
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, deleteDoc, setDoc, writeBatch } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Plus, Pencil, Trash2, Search, Tag, Layers, ArrowUpDown, ArrowUp, ArrowDown, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { Product } from '@/lib/types';

interface Category {
  id: string;
  name: string;
  group?: string;
  groupId?: string;
}

interface MenuItemGroup {
  id: string;
  name: string;
}

interface DisplayCategory extends Category {
  isFromDb: boolean;
  itemCount: number;
}

type SortConfig = {
  key: 'name' | 'group' | 'itemCount';
  direction: 'asc' | 'desc';
};

export default function AdminCategoriesPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState<Category | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isBulkRegistering, setIsBulkRegistering] = useState(false);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'name', direction: 'asc' });

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');

  // Fetch Groups from DB
  const groupsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'menuItemGroups');
  }, [firestore]);
  const { data: groups, isLoading: isGroupsLoading } = useCollection<MenuItemGroup>(groupsQuery);

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
      setSelectedGroupId(isEditing.groupId || '');
    } else if (isAdding) {
      setSelectedGroupId('');
    }
  }, [isEditing, isAdding]);

  const categoryUsage = useMemo(() => {
    const counts: Record<string, number> = {};
    menuItems?.forEach(item => {
      const catName = (item.category || 'Tanpa Kategori').trim();
      counts[catName] = (counts[catName] || 0) + 1;
    });
    return counts;
  }, [menuItems]);

  const groupLookup = useMemo(() => {
    const map: Record<string, string> = {};
    groups?.forEach(g => { map[g.id] = g.name; });
    return map;
  }, [groups]);

  const handleSort = (key: 'name' | 'group' | 'itemCount') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: 'name' | 'group' | 'itemCount') => {
    if (sortConfig.key !== key) return <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-4 w-4 text-primary" /> : <ArrowDown className="ml-2 h-4 w-4 text-primary" />;
  };

  const displayCategories = useMemo((): DisplayCategory[] => {
    const dbCatNames = new Set(categories?.map(c => c.name.trim().toLowerCase()) || []);
    const itemCatNames = Object.keys(categoryUsage);
    
    let list: DisplayCategory[] = (categories || []).map(c => ({
      ...c,
      isFromDb: true,
      itemCount: categoryUsage[c.name.trim()] || 0
    }));
    
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

    // Apply Filters
    let result = list.filter(c => {
      const gName = groupLookup[c.groupId || ''] || c.group || 'Belum diset';
      
      const matchesGlobal = searchTerm === '' || 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        gName.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesName = nameFilter === '' || c.name.toLowerCase().includes(nameFilter.toLowerCase());
      const matchesGroup = groupFilter === '' || gName.toLowerCase().includes(groupFilter.toLowerCase());

      return matchesGlobal && matchesName && matchesGroup;
    });

    // Apply Sorting
    if (sortConfig.key) {
      result.sort((a, b) => {
        let valA: any = '';
        let valB: any = '';

        if (sortConfig.key === 'name') {
          valA = a.name.toLowerCase();
          valB = b.name.toLowerCase();
        } else if (sortConfig.key === 'group') {
          valA = (groupLookup[a.groupId || ''] || a.group || 'Belum diset').toLowerCase();
          valB = (groupLookup[b.groupId || ''] || b.group || 'Belum diset').toLowerCase();
        } else if (sortConfig.key === 'itemCount') {
          valA = a.itemCount;
          valB = b.itemCount;
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [categories, categoryUsage, searchTerm, nameFilter, groupFilter, sortConfig, groupLookup]);

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

  const resetFilters = () => {
    setSearchTerm('');
    setNameFilter('');
    setGroupFilter('');
    setSortConfig({ key: 'name', direction: 'asc' });
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
      toast({ title: "Berhasil", description: `Kategori "${name}" telah didaftarkan.` });
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
      toast({ title: "Berhasil", description: `${selectedIds.size} kategori baru didaftarkan.` });
      setSelectedIds(new Set());
    } catch (error) {
      toast({ variant: "destructive", title: "Gagal", description: "Gagal mendaftarkan masal." });
    } finally {
      setIsBulkRegistering(false);
    }
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore) return;

    const formData = new FormData(e.currentTarget);
    const categoryName = (formData.get('name') as string).trim();
    
    const categoryData: Category = {
      id: isEditing?.id || (Math.floor(Math.random() * 1000) + 1000).toString(),
      name: categoryName,
      groupId: selectedGroupId,
      group: groupLookup[selectedGroupId] || '', // Maintain for backward compatibility
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

  if (isLoading || isItemsLoading || isGroupsLoading) {
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
            <Button size="sm" onClick={handleBulkRegister} disabled={isBulkRegistering}>
              Daftarkan Terpilih ({selectedIds.size})
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={resetFilters}>
            <X className="mr-2 h-4 w-4" /> Reset Filter
          </Button>
          <Dialog open={isAdding} onOpenChange={setIsAdding}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" /> Tambah Kategori
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Tambah Kategori Baru</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Nama Kategori</Label>
                    <Input id="name" name="name" placeholder="Contoh: Nasi & Lauk" required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="group">Pilih Grup (Master Grup)</Label>
                    <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih Grup" />
                      </SelectTrigger>
                      <SelectContent>
                        {groups?.map((g) => (
                          <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
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

      <Card className="p-4 border-primary/10 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="space-y-2">
            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Cari Kategori</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Nama kategori..."
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
                className="pl-10 h-9 text-sm"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Cari Grup</Label>
            <div className="relative">
              <Layers className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Nama grup..."
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
                className="pl-10 h-9 text-sm"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Pencarian Global</Label>
            <Input
              placeholder="Cari apa saja..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
        </div>
      </Card>

      <div className="flex items-center gap-2 text-sm text-muted-foreground px-1">
        <span>Total Terfilter:</span>
        <span className="font-bold text-foreground bg-primary/10 px-2 py-0.5 rounded">{displayCategories.length}</span>
        <span className="text-[10px] uppercase tracking-tighter">dari {categories?.length || 0} Kategori Master</span>
      </div>

      <Card>
        <CardContent className="p-0 overflow-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-[50px]">
                  <Checkbox 
                    checked={orphanIds.size > 0 && selectedIds.size === orphanIds.size}
                    onCheckedChange={toggleSelectAll}
                    disabled={orphanIds.size === 0}
                  />
                </TableHead>
                <TableHead className="w-[60px] text-[10px] font-bold uppercase tracking-widest">No.</TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort('name')}>
                  <div className="flex items-center text-[10px] font-bold uppercase tracking-widest">
                    Nama Kategori {getSortIcon('name')}
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort('group')}>
                  <div className="flex items-center text-[10px] font-bold uppercase tracking-widest">
                    Grup Kategori {getSortIcon('group')}
                  </div>
                </TableHead>
                <TableHead className="text-center cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort('itemCount')}>
                  <div className="flex items-center justify-center text-[10px] font-bold uppercase tracking-widest">
                    Jumlah Menu {getSortIcon('itemCount')}
                  </div>
                </TableHead>
                <TableHead className="text-right text-[10px] font-bold uppercase tracking-widest">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayCategories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Search className="h-8 w-8 opacity-20" />
                      <p>Tidak ada kategori yang cocok.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                displayCategories.map((category, index) => {
                  const groupName = groupLookup[category.groupId || ''] || category.group || 'Belum diset';
                  return (
                    <TableRow key={category.id} className={cn("hover:bg-primary/5 transition-colors", !category.isFromDb && "bg-destructive/5")}>
                      <TableCell>
                        {!category.isFromDb && (
                          <Checkbox 
                            checked={selectedIds.has(category.id)}
                            onCheckedChange={() => toggleSelect(category.id)}
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono text-[10px]">{index + 1}</TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Tag className="h-4 w-4 text-primary/70" />
                          <span className="uppercase font-bold text-xs tracking-tight">{category.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Layers className="h-3 w-3 text-muted-foreground" />
                          <Badge variant="secondary" className="font-normal text-[10px] bg-blue-50 text-blue-700">
                            {groupName}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full text-xs font-bold ${category.itemCount > 0 ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}>
                          {category.itemCount}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {!category.isFromDb ? (
                            <Button size="sm" variant="secondary" onClick={() => handleRegisterOrphan(category.name)} className="h-8 text-[10px] font-bold">
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
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Edit Kategori</DialogTitle>
                                  </DialogHeader>
                                  <form onSubmit={handleSave} className="space-y-4">
                                    <div className="grid gap-4 py-4">
                                      <div className="grid gap-2">
                                        <Label htmlFor="edit-name">Nama Kategori</Label>
                                        <Input id="edit-name" name="name" defaultValue={category.name} required />
                                      </div>
                                      <div className="grid gap-2">
                                        <Label htmlFor="edit-group">Grup Kategori</Label>
                                        <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                                          <SelectTrigger>
                                            <SelectValue placeholder="Pilih Grup" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {groups?.map((g) => (
                                              <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
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
