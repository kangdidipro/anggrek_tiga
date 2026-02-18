'use client';

import { useState } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, deleteDoc, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Plus, Pencil, Trash2, RefreshCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Vendor, Product } from '@/lib/types';

export default function AdminVendorsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState<Vendor | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Fetch Vendors
  const vendorsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'vendors');
  }, [firestore]);
  const { data: vendors, isLoading: isVendorsLoading } = useCollection<Vendor>(vendorsQuery);

  // Fetch Menu Items for Import Logic
  const menuItemsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'menuItems');
  }, [firestore]);
  const { data: menuItems } = useCollection<Product>(menuItemsQuery);

  const handleDelete = async (id: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'vendors', id));
      toast({ title: "Berhasil", description: "Mitra telah dihapus." });
    } catch (error) {
      toast({ variant: "destructive", title: "Gagal", description: "Tidak dapat menghapus mitra." });
    }
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore) return;

    const formData = new FormData(e.currentTarget);
    const vendorData: Vendor = {
      id: isEditing?.id || (Math.floor(Math.random() * 1000) + 100).toString(),
      name: formData.get('name') as string,
      code: formData.get('code') as string,
    };

    try {
      await setDoc(doc(firestore, 'vendors', vendorData.id), vendorData);
      toast({ title: "Berhasil", description: "Data mitra telah disimpan." });
      setIsEditing(null);
      setIsAdding(false);
    } catch (error) {
      toast({ variant: "destructive", title: "Gagal", description: "Tidak dapat menyimpan data mitra." });
    }
  };

  const handleImportFromMenu = async () => {
    if (!firestore || !menuItems) return;
    setIsImporting(true);
    
    try {
      const vendorCodes = new Set<string>();
      menuItems.forEach(item => {
        if (item.sku && item.sku.includes('-')) {
          // Ambil kode sebelum tanda "-"
          const code = item.sku.split('-')[0].trim();
          if (code) vendorCodes.add(code);
        }
      });

      const existingCodes = new Set(vendors?.map(v => v.code) || []);
      let importedCount = 0;

      for (const code of vendorCodes) {
        if (!existingCodes.has(code)) {
          const vendorData: Vendor = {
            id: (Math.floor(Math.random() * 1000) + 500).toString(),
            name: code, // Sesuai permintaan: Nama Mitra = Kode Mitra
            code: code,
          };
          await setDoc(doc(firestore, 'vendors', vendorData.id), vendorData);
          importedCount++;
        }
      }

      if (importedCount > 0) {
        toast({ title: "Berhasil", description: `${importedCount} mitra baru berhasil diimport dari data menu.` });
      } else {
        toast({ title: "Info", description: "Semua kode mitra dari menu sudah terdaftar di Master Mitra." });
      }
    } catch (error) {
      console.error("Import error:", error);
      toast({ variant: "destructive", title: "Gagal", description: "Terjadi kesalahan saat mengimport data mitra." });
    } finally {
      setIsImporting(false);
    }
  };

  if (isVendorsLoading) {
    return <div className="flex h-full items-center justify-center p-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">Master Mitra</h1>
          <p className="text-muted-foreground">Kelola daftar vendor atau mitra TakjilKu.</p>
        </div>
        <div className="flex gap-2">
          {menuItems && menuItems.length > 0 && (
            <Button variant="outline" onClick={handleImportFromMenu} disabled={isImporting}>
              {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
              Import dari Menu
            </Button>
          )}
          <Dialog open={isAdding} onOpenChange={setIsAdding}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Tambah Mitra
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Tambah Mitra Baru</DialogTitle>
                <DialogDescription>Masukkan rincian mitra baru.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Nama Mitra / Brand</Label>
                    <Input id="name" name="name" placeholder="Contoh: Dapur Bunda" required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="code">Kode Mitra (Singkatan)</Label>
                    <Input id="code" name="code" placeholder="Contoh: DB" required />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" className="w-full">Simpan Mitra</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama Mitra</TableHead>
                <TableHead>Kode</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!vendors || vendors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-12 text-muted-foreground">
                    Belum ada mitra yang terdaftar.
                  </TableCell>
                </TableRow>
              ) : (
                vendors.sort((a, b) => a.name.localeCompare(b.name)).map((vendor) => (
                  <TableRow key={vendor.id}>
                    <TableCell className="font-medium">{vendor.name}</TableCell>
                    <TableCell className="font-mono font-bold">{vendor.code}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Dialog open={isEditing?.id === vendor.id} onOpenChange={(open) => !open && setIsEditing(null)}>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => setIsEditing(vendor)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                              <DialogTitle>Edit Mitra</DialogTitle>
                              <DialogDescription>Ubah rincian mitra.</DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleSave} className="space-y-4">
                              <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                  <Label htmlFor="edit-name">Nama Mitra / Brand</Label>
                                  <Input id="edit-name" name="name" defaultValue={vendor.name} required />
                                </div>
                                <div className="grid gap-2">
                                  <Label htmlFor="edit-code">Kode Mitra (Singkatan)</Label>
                                  <Input id="edit-code" name="code" defaultValue={vendor.code} required />
                                </div>
                              </div>
                              <DialogFooter>
                                <Button type="submit" className="w-full">Simpan Perubahan</Button>
                              </DialogFooter>
                            </form>
                          </DialogContent>
                        </Dialog>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(vendor.id)}>
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
