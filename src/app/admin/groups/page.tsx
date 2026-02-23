'use client';

import { useState, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, doc, deleteDoc, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Plus, Pencil, Trash2, Search, Layers, ArrowUpDown, ArrowUp, ArrowDown, X, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface MenuItemGroup {
  id: string;
  name: string;
  description?: string;
}

type SortConfig = {
  key: keyof MenuItemGroup;
  direction: 'asc' | 'desc';
};

export default function AdminGroupsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState<MenuItemGroup | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [descFilter, setDescFilter] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'name', direction: 'asc' });

  const groupsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'menuItemGroups');
  }, [firestore]);
  const { data: groups, isLoading } = useCollection<MenuItemGroup>(groupsQuery);

  const handleSort = (key: keyof MenuItemGroup) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: keyof MenuItemGroup) => {
    if (sortConfig.key !== key) return <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-4 w-4 text-primary" /> : <ArrowDown className="ml-2 h-4 w-4 text-primary" />;
  };

  const filteredGroups = useMemo(() => {
    if (!groups) return [];
    
    let result = groups.filter(g => {
      const matchesGlobal = searchTerm === '' || 
        g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (g.description || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesName = nameFilter === '' || g.name.toLowerCase().includes(nameFilter.toLowerCase());
      const matchesDesc = descFilter === '' || (g.description || '').toLowerCase().includes(descFilter.toLowerCase());

      return matchesGlobal && matchesName && matchesDesc;
    });

    if (sortConfig.key) {
      result.sort((a, b) => {
        const valA = (a[sortConfig.key] || '').toString().toLowerCase();
        const valB = (b[sortConfig.key] || '').toString().toLowerCase();

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [groups, searchTerm, nameFilter, descFilter, sortConfig]);

  const resetFilters = () => {
    setSearchTerm('');
    setNameFilter('');
    setDescFilter('');
    setSortConfig({ key: 'name', direction: 'asc' });
  };

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore) return;

    const formData = new FormData(e.currentTarget);
    const groupData: MenuItemGroup = {
      id: isEditing?.id || (Math.floor(Math.random() * 1000) + 100).toString(),
      name: (formData.get('name') as string).trim(),
      description: (formData.get('description') as string).trim(),
    };

    const groupRef = doc(firestore, 'menuItemGroups', groupData.id);

    setDoc(groupRef, groupData, { merge: true })
      .then(() => {
        toast({ title: "Berhasil", description: "Grup telah disimpan." });
        setIsEditing(null);
        setIsAdding(false);
      })
      .catch(async (serverError) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: groupRef.path,
          operation: isEditing ? 'update' : 'create',
          requestResourceData: groupData
        }));
      });
  };

  const handleDelete = (id: string) => {
    if (!firestore) return;
    const groupRef = doc(firestore, 'menuItemGroups', id);
    
    deleteDoc(groupRef)
      .then(() => {
        toast({ title: "Berhasil", description: "Grup telah dihapus." });
      })
      .catch(async (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: groupRef.path,
          operation: 'delete'
        }));
      });
  };

  if (isLoading) {
    return <div className="flex h-full items-center justify-center p-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">Master Grup Kategori</h1>
          <p className="text-muted-foreground">Kelola pengelompokan utama menu (Makanan Utama, Minuman, dll).</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={resetFilters}>
            <X className="mr-2 h-4 w-4" /> Reset Filter
          </Button>
          <Dialog open={isAdding} onOpenChange={setIsAdding}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" /> Tambah Grup
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Tambah Grup Baru</DialogTitle>
                <DialogDescription>Grup ini akan muncul sebagai pilihan di Master Kategori.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Nama Grup</Label>
                  <Input id="name" name="name" placeholder="Contoh: Makanan Utama" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Deskripsi</Label>
                  <Textarea id="description" name="description" placeholder="Deskripsi singkat..." />
                </div>
                <DialogFooter>
                  <Button type="submit" className="w-full">Simpan Grup</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="p-4 border-primary/10 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="space-y-2">
            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Cari Nama</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Nama grup..."
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
                className="pl-10 h-9 text-sm"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Cari Deskripsi</Label>
            <div className="relative">
              <Info className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Deskripsi..."
                value={descFilter}
                onChange={(e) => setDescFilter(e.target.value)}
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
        <span className="font-bold text-foreground bg-primary/10 px-2 py-0.5 rounded">{filteredGroups.length}</span>
        <span className="text-[10px] uppercase tracking-tighter">dari {groups?.length || 0} Grup</span>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-[60px]">No.</TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50 transition-colors" 
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center text-[10px] font-bold uppercase tracking-widest">
                    Nama Grup {getSortIcon('name')}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50 transition-colors" 
                  onClick={() => handleSort('description')}
                >
                  <div className="flex items-center text-[10px] font-bold uppercase tracking-widest">
                    Deskripsi {getSortIcon('description')}
                  </div>
                </TableHead>
                <TableHead className="text-right text-[10px] font-bold uppercase tracking-widest">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredGroups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Search className="h-8 w-8 opacity-20" />
                      <p>Tidak ada grup yang cocok dengan filter.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredGroups.map((group, index) => (
                  <TableRow key={group.id} className="hover:bg-primary/5 transition-colors">
                    <TableCell className="text-muted-foreground font-mono text-xs">{index + 1}</TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Layers className="h-4 w-4 text-primary/70" />
                        <span className="uppercase font-bold text-xs tracking-tight">{group.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[300px] italic">
                      {group.description || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Dialog open={isEditing?.id === group.id} onOpenChange={(open) => !open && setIsEditing(null)}>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => setIsEditing(group)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Edit Grup</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleSave} className="space-y-4">
                              <div className="grid gap-2">
                                <Label htmlFor="edit-name">Nama Grup</Label>
                                <Input id="edit-name" name="name" defaultValue={group.name} required />
                              </div>
                              <div className="grid gap-2">
                                <Label htmlFor="edit-desc">Deskripsi</Label>
                                <Textarea id="edit-desc" name="description" defaultValue={group.description} />
                              </div>
                              <DialogFooter>
                                <Button type="submit" className="w-full">Simpan Perubahan</Button>
                              </DialogFooter>
                            </form>
                          </DialogContent>
                        </Dialog>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(group.id)}>
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
    </div>
  );
}