
'use client';

import { useState } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, deleteDoc, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Plus, Pencil, Trash2, Search, Layers } from 'lucide-react';
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

export default function AdminGroupsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState<MenuItemGroup | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const groupsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'menuItemGroups');
  }, [firestore]);
  const { data: groups, isLoading } = useCollection<MenuItemGroup>(groupsQuery);

  const filteredGroups = (groups || []).filter(g => 
    g.name.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => a.name.localeCompare(b.name));

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore) return;

    const formData = new FormData(e.currentTarget);
    const groupData: MenuItemGroup = {
      id: isEditing?.id || (Math.floor(Math.random() * 1000) + 100).toString(),
      name: (formData.get('name') as string).trim(),
      description: (formData.get('description') as string).trim(),
    };

    try {
      await setDoc(doc(firestore, 'menuItemGroups', groupData.id), groupData, { merge: true });
      toast({ title: "Berhasil", description: "Grup telah disimpan." });
      setIsEditing(null);
      setIsAdding(false);
    } catch (error) {
      toast({ variant: "destructive", title: "Gagal", description: "Tidak dapat menyimpan grup." });
    }
  };

  const handleDelete = async (id: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'menuItemGroups', id));
      toast({ title: "Berhasil", description: "Grup telah dihapus." });
    } catch (error) {
      toast({ variant: "destructive", title: "Gagal", description: "Tidak dapat menghapus grup." });
    }
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

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cari grup..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">No.</TableHead>
                <TableHead>Nama Grup</TableHead>
                <TableHead>Deskripsi</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredGroups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                    Belum ada grup kategori.
                  </TableCell>
                </TableRow>
              ) : (
                filteredGroups.map((group, index) => (
                  <TableRow key={group.id}>
                    <TableCell className="text-muted-foreground font-mono text-xs">{index + 1}</TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Layers className="h-4 w-4 text-primary/70" />
                        {group.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate">
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
