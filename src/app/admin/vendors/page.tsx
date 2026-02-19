'use client';

import { useState, useRef, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, deleteDoc, setDoc, writeBatch } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Plus, Pencil, Trash2, RefreshCcw, FileUp, FileDown, Search, ExternalLink, Copy, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import type { Vendor, Product } from '@/lib/types';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import Link from 'next/link';
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

type SortConfig = {
  key: keyof Vendor | null;
  direction: 'asc' | 'desc';
};

export default function AdminVendorsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState<Vendor | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isExcelImporting, setIsExcelImporting] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'name', direction: 'asc' });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
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

  const handleSort = (key: keyof Vendor) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: keyof Vendor) => {
    if (sortConfig.key !== key) return <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />;
  };

  const filteredVendors = useMemo(() => {
    if (!vendors) return [];
    let result = vendors.filter(vendor => 
      vendor.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      vendor.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (vendor.email && vendor.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (vendor.phoneNumber && vendor.phoneNumber.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (sortConfig.key) {
      result.sort((a, b) => {
        const valA = (a[sortConfig.key!] || '').toString().toLowerCase();
        const valB = (b[sortConfig.key!] || '').toString().toLowerCase();

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [vendors, searchTerm, sortConfig]);

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredVendors.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredVendors.map(v => v.id)));
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
      await deleteDoc(doc(firestore, 'vendors', id));
      toast({ title: "Berhasil", description: "Mitra telah dihapus." });
      const newSelected = new Set(selectedIds);
      newSelected.delete(id);
      setSelectedIds(newSelected);
    } catch (error) {
      toast({ variant: "destructive", title: "Gagal", description: "Tidak dapat menghapus mitra." });
    }
  };

  const handleBulkDelete = async () => {
    if (!firestore || selectedIds.size === 0) return;
    setIsBulkDeleting(true);
    
    const batch = writeBatch(firestore);
    selectedIds.forEach(id => {
      batch.delete(doc(firestore, 'vendors', id));
    });

    try {
      await batch.commit();
      toast({
        title: "Berhasil",
        description: `${selectedIds.size} mitra telah dihapus.`,
      });
      setSelectedIds(new Set());
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: "Terjadi kesalahan saat menghapus data terpilih.",
      });
    } finally {
      setIsBulkDeleting(false);
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

  const exportToExcel = () => {
    if (!filteredVendors || filteredVendors.length === 0) return;

    const dataForExport = filteredVendors.map((vendor, index) => ({
      'No.': index + 1,
      'Nama Mitra': vendor.name,
      'Kode': vendor.code,
      'Email': vendor.email || '-',
      'No HP': vendor.phoneNumber || '-',
      'Link Pesanan': `${window.location.origin}/mitra/${vendor.code}`
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataForExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Daftar Mitra");
    
    const wscols = [
        {wch: 5},  // No.
        {wch: 35}, // Nama Mitra
        {wch: 15}, // Kode
        {wch: 30}, // Email
        {wch: 20}, // No HP
        {wch: 60}  // Link Pesanan
    ];
    worksheet['!cols'] = wscols;

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const dataBlob = new Blob([excelBuffer], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8'});
    saveAs(dataBlob, `master_mitra_${new Date().toISOString().split('T')[0]}.xlsx`);
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
          <Button variant="outline" size="sm" onClick={exportToExcel} disabled={filteredVendors.length === 0}>
            <FileDown className="mr-2 h-4 w-4" />
            Export Excel
          </Button>
          {menuItems && menuItems.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleImportFromMenu} disabled={isImporting}>
              {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
              Import dari Menu
            </Button>
          )}

          {selectedIds.size > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Hapus Terpilih ({selectedIds.size})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Hapus {selectedIds.size} Mitra?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tindakan ini akan menghapus seluruh data mitra yang telah Anda pilih secara permanen.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Batal</AlertDialogCancel>
                  <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive hover:bg-destructive/90">
                    {isBulkDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Ya, Hapus Semua
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
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
                <TableHead className="w-[50px]">
                  <Checkbox 
                    checked={filteredVendors.length > 0 && selectedIds.size === filteredVendors.length}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Pilih semua"
                  />
                </TableHead>
                <TableHead className="w-[60px]">No.</TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('name')}>
                  <div className="flex items-center">
                    Nama Mitra {getSortIcon('name')}
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('code')}>
                  <div className="flex items-center">
                    Kode {getSortIcon('code')}
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('email')}>
                  <div className="flex items-center">
                    Email {getSortIcon('email')}
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('phoneNumber')}>
                  <div className="flex items-center">
                    No HP {getSortIcon('phoneNumber')}
                  </div>
                </TableHead>
                <TableHead>Link Pesanan</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVendors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    {searchTerm ? 'Tidak ada mitra yang cocok dengan pencarian.' : 'Belum ada mitra yang terdaftar.'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredVendors.map((vendor, index) => (
                  <TableRow key={vendor.id} className={selectedIds.has(vendor.id) ? 'bg-muted/50' : ''}>
                    <TableCell>
                      <Checkbox 
                        checked={selectedIds.has(vendor.id)}
                        onCheckedChange={() => toggleSelect(vendor.id)}
                        aria-label={`Pilih ${vendor.name}`}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">{index + 1}</TableCell>
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
