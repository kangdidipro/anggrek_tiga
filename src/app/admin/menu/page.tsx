'use client';

import { useState } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, deleteDoc, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Plus, Pencil, Trash2, RefreshCcw } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { products as initialProducts } from '@/lib/products';
import type { Product, Vendor } from '@/lib/types';

export default function AdminMenuPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState<Product | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

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

  const handleDelete = async (id: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'menuItems', id));
      toast({ title: "Berhasil", description: "Menu telah dihapus." });
    } catch (error) {
      toast({ variant: "destructive", title: "Gagal", description: "Tidak dapat menghapus menu." });
    }
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore) return;

    const formData = new FormData(e.currentTarget);
    const productData: Product = {
      id: isEditing?.id || (Math.floor(Math.random() * 1000) + 100).toString(),
      name: formData.get('name') as string,
      price: Number(formData.get('price')),
      sku: formData.get('sku') as string,
      category: formData.get('category') as string,
      vendor: formData.get('vendor') as string,
    };

    try {
      await setDoc(doc(firestore, 'menuItems', productData.id), productData);
      toast({ title: "Berhasil", description: "Menu telah disimpan." });
      setIsEditing(null);
      setIsAdding(false);
    } catch (error) {
      toast({ variant: "destructive", title: "Gagal", description: "Tidak dapat menyimpan menu." });
    }
  };

  const seedDefaultMenu = async () => {
    if (!firestore) return;
    setIsSeeding(true);
    try {
      for (const product of initialProducts) {
        await setDoc(doc(firestore, 'menuItems', product.id), product);
      }
      toast({ title: "Berhasil", description: "Menu default telah diunggah ke database." });
    } catch (error) {
      toast({ variant: "destructive", title: "Gagal", description: "Tidak dapat mengunggah menu default." });
    } finally {
      setIsSeeding(false);
    }
  };

  if (isLoading || isVendorsLoading) {
    return <div className="flex h-full items-center justify-center p-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">Manajemen Menu</h1>
          <p className="text-muted-foreground">Tambah, ubah, atau hapus menu takjil yang tersedia.</p>
        </div>
        <div className="flex gap-2">
          {(!menuItems || menuItems.length === 0) && (
            <Button variant="outline" onClick={seedDefaultMenu} disabled={isSeeding}>
              {isSeeding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
              Gunakan Menu Default
            </Button>
          )}
          <Dialog open={isAdding} onOpenChange={setIsAdding}>
            <DialogTrigger asChild>
              <Button>
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
                      <Input id="price" name="price" type="number" placeholder="12000" required />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="sku">SKU / Kode Produk</Label>
                      <Input id="sku" name="sku" placeholder="NL-001" required />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="category">Kategori</Label>
                      <Select name="category" defaultValue="Nasi & Lauk" required>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih Kategori" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Nasi & Lauk">Nasi & Lauk</SelectItem>
                          <SelectItem value="Mie & Soto">Mie & Soto</SelectItem>
                          <SelectItem value="Pempek">Pempek</SelectItem>
                          <SelectItem value="Jajanan Asin">Jajanan Asin</SelectItem>
                          <SelectItem value="Jajanan Manis">Jajanan Manis</SelectItem>
                          <SelectItem value="Bubur & Puding">Bubur & Puding</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="vendor">Vendor / Penjual</Label>
                      <Select name="vendor" required>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih Vendor" />
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
                </div>
                <DialogFooter>
                  <Button type="submit" className="w-full">Simpan Menu</Button>
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
                <TableHead>Nama</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Harga</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!menuItems || menuItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    Belum ada menu di database. Gunakan menu default atau tambah baru.
                  </TableCell>
                </TableRow>
              ) : (
                menuItems.sort((a, b) => a.category.localeCompare(b.category)).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.category}</TableCell>
                    <TableCell className="font-mono text-xs font-bold">{item.vendor}</TableCell>
                    <TableCell>{item.sku}</TableCell>
                    <TableCell className="text-right">{formatPrice(item.price)}</TableCell>
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
                                    <Input id="edit-price" name="price" type="number" defaultValue={item.price} required />
                                  </div>
                                  <div className="grid gap-2">
                                    <Label htmlFor="edit-sku">SKU / Kode Produk</Label>
                                    <Input id="edit-sku" name="sku" defaultValue={item.sku} required />
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="grid gap-2">
                                    <Label htmlFor="edit-category">Kategori</Label>
                                    <Select name="category" defaultValue={item.category} required>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Pilih Kategori" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="Nasi & Lauk">Nasi & Lauk</SelectItem>
                                        <SelectItem value="Mie & Soto">Mie & Soto</SelectItem>
                                        <SelectItem value="Pempek">Pempek</SelectItem>
                                        <SelectItem value="Jajanan Asin">Jajanan Asin</SelectItem>
                                        <SelectItem value="Jajanan Manis">Jajanan Manis</SelectItem>
                                        <SelectItem value="Bubur & Puding">Bubur & Puding</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="grid gap-2">
                                    <Label htmlFor="edit-vendor">Vendor / Penjual</Label>
                                    <Select name="vendor" defaultValue={item.vendor} required>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Pilih Vendor" />
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
    </div>
  );
}
