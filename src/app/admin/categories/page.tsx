
'use client';

import { useState, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, deleteDoc, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Plus, Pencil, Trash2, Search, Tag } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Category {
  id: string;
  name: string;
}

export default function AdminCategoriesPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState<Category | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch Categories
  const categoriesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'categories');
  }, [firestore]);
  const { data: categories, isLoading } = useCollection<Category>(categoriesQuery);

  const filteredCategories = useMemo(() => {
    if (!categories) return [];
    return categories.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => a.name.localeCompare(b.name));
  }, [categories, searchTerm]);

  const handleDelete = async (id: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'categories', id));
      toast({ title: "Berhasil", description: "Kategori telah dihapus." });
    } catch (error) {
      toast({ variant: "destructive", title: "Gagal", description: "Tidak dapat menghapus kategori." });
    }
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore) return;

    const formData = new FormData(e.currentTarget);
    const categoryData: Category = {
      id: isEditing?.id || (Math.floor(Math.random() * 1000) + 100).toString(),
      name: formData.get('name') as string,
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

  if (isLoading) {
    return <div className="flex h-full items-center justify-center p-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">Master Kategori</h1>
          <p className="text-muted-foreground">Kelola daftar kategori menu takjil.</p>
        </div>
        <Dialog open={isAdding} onOpenChange={setIsAdding}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" /> Tambah Kategori
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Tambah Kategori Baru</DialogTitle>
              <DialogDescription>Masukkan nama kategori baru.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Nama Kategori</Label>
                  <Input id="name" name="name" placeholder="Contoh: Nasi & Lauk" required />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" className="w-full">Simpan Kategori</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cari kategori..."
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
                <TableHead className="w-[60px]">No.</TableHead>
                <TableHead>Nama Kategori</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCategories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-12 text-muted-foreground">
                    Belum ada kategori.
                  </TableCell>
                </TableRow>
              ) : (
                filteredCategories.map((category, index) => (
                  <TableRow key={category.id}>
                    <TableCell className="text-muted-foreground font-mono text-xs">{index + 1}</TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4 text-primary/70" />
                        {category.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Dialog open={isEditing?.id === category.id} onOpenChange={(open) => !open && setIsEditing(null)}>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => setIsEditing(category)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                              <DialogTitle>Edit Kategori</DialogTitle>
                              <DialogDescription>Ubah nama kategori.</DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleSave} className="space-y-4">
                              <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                  <Label htmlFor="edit-name">Nama Kategori</Label>
                                  <Input id="edit-name" name="name" defaultValue={category.name} required />
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
