
'use client';

import { useState, useRef, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, deleteDoc, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Plus, Pencil, Trash2, RefreshCcw, FileUp, Search, ExternalLink, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Vendor, Product } from '@/lib/types';
import * as XLSX from 'xlsx';
import Link from 'next/link';

export default function AdminVendorsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState<Vendor | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isExcelImporting, setIsExcelImporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch Mitra
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

  const filteredVendors = useMemo(() => {
    if (!vendors) return [];
    return vendors
      .filter(vendor => 
        vendor.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        vendor.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (vendor.email && vendor.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (vendor.phoneNumber && vendor.phoneNumber.toLowerCase().includes(searchTerm.toLowerCase()))
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [vendors, searchTerm]);

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
      email: (formData.get('email') as string) || '',
      phoneNumber: (formData.get('phoneNumber') as string) || '',
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
            name: code,
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
        const existingCodes = new Set(vendors?.map(v => v.code) || []);

        for (const row of jsonData) {
          const name = row['Nama Mitra'] || row['Nama'] || Object.values(row)[0];
          const code = row['Kode Mitra'] || row['Kode'] || Object.values(row)[1];
          const email = row['Email'] || '';
          const phone = row['No HP'] || row['Telepon'] || row['Phone'] || row['PhoneNumber'] || '';

          if (name && code && !existingCodes.has(String(code))) {
            const vendorData: Vendor = {
              id: (Math.floor(Math.random() * 10000) + 1000).toString(),
              name: String(name),
              code: String(code),
              email: String(email),
              phoneNumber: String(phone),
            };
            await setDoc(doc(firestore, 'vendors', vendorData.id), vendorData);
            importedCount++;
            existingCodes.add(String(code));
          }
        }

        toast({
          title: "Import Selesai",
          description: `${importedCount} mitra berhasil diimport dari Excel.`,
        });
      } catch (error) {
        console.error("Excel import error:", error);
        toast({
          variant: "destructive",
          title: "Gagal Import",
          description: "Pastikan format file Excel benar.",
        });
      } finally {
        setIsExcelImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const copyToClipboard = (code: string) => {
    const url = `${window.location.origin}/mitra/${code}`;
    navigator.clipboard.writeText(url);
    toast({
      title: "Link Disalin",
      description: "Link daftar pesanan mitra telah disalin ke clipboard.",
    });
  };

  if (isVendorsLoading) {
    return <div className="flex h-full items-center justify-center p-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">Master Mitra</h1>
          <p className="text-muted-foreground">Kelola daftar mitra TakjilKu.</p>
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
          {menuItems && menuItems.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleImportFromMenu} disabled={isImporting}>
              {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
              Import dari Menu
            </Button>
          )}
          <Dialog open={isAdding} onOpenChange={setIsAdding}>
            <DialogTrigger asChild>
              <Button size="sm">
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
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email Mitra</Label>
                    <Input id="email" name="email" type="email" placeholder="mitra@email.com" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="phoneNumber">No HP / WhatsApp</Label>
                    <Input id="phoneNumber" name="phoneNumber" placeholder="08123456789" />
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

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cari nama, kode, email, atau no hp..."
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
                <TableHead>Nama Mitra</TableHead>
                <TableHead>Kode</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>No HP</TableHead>
                <TableHead>Link Pesanan</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVendors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    {searchTerm ? 'Tidak ada mitra yang cocok dengan pencarian.' : 'Belum ada mitra yang terdaftar.'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredVendors.map((vendor) => (
                  <TableRow key={vendor.id}>
                    <TableCell className="font-medium">{vendor.name}</TableCell>
                    <TableCell className="font-mono font-bold">{vendor.code}</TableCell>
                    <TableCell>{vendor.email || '-'}</TableCell>
                    <TableCell>{vendor.phoneNumber || '-'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/mitra/${vendor.code}`} target="_blank">
                            <ExternalLink className="h-3 w-3 mr-2" />
                            Buka
                          </Link>
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => copyToClipboard(vendor.code)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
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
                                <div className="grid gap-2">
                                  <Label htmlFor="edit-email">Email Mitra</Label>
                                  <Input id="edit-email" name="email" type="email" defaultValue={vendor.email} placeholder="mitra@email.com" />
                                </div>
                                <div className="grid gap-2">
                                  <Label htmlFor="edit-phone">No HP / WhatsApp</Label>
                                  <Input id="edit-phone" name="phoneNumber" defaultValue={vendor.phoneNumber} placeholder="08123456789" />
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
