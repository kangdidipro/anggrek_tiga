'use client';

import { useState, useEffect, useRef } from 'react';
import { useFirestore, errorEmitter, FirestorePermissionError, useDoc, useMemoFirebase } from '@/firebase';
import { collection, getDocs, writeBatch, query, collectionGroup, doc, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Mail, Database, Trash2, Save, AlertTriangle, Send, Info, ExternalLink, Download, Upload, FileJson, Package, Skull, Truck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { sendSmtpEmail, type SmtpConfig } from '@/app/actions';
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
import Link from 'next/link';

const TABLES = [
  { id: 'menuItems', label: 'Menu Takjil', description: 'Daftar makanan & minuman yang dijual.' },
  { id: 'vendors', label: 'Master Mitra', description: 'Data UMKM / Penjual.' },
  { id: 'customers', label: 'Data Pelanggan', description: 'Profil warga yang pernah memesan.' },
  { id: 'orders', label: 'Data Pesanan', description: 'Riwayat pesanan (Orders).' },
  { id: 'orderItems', label: 'Detail Pesanan', description: 'Rincian item di dalam pesanan.' },
  { id: 'settings', label: 'Pengaturan Sistem', description: 'Konfigurasi SMTP & Parameter.' },
];

export default function AdminSettingsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [isSavingParams, setIsSavingParams] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const restoreFileInputRef = useRef<HTMLInputElement>(null);

  // Maintenance States
  const [confirmInput, setConfirmInput] = useState('');
  const [actionTarget, setActionTarget] = useState<{ id: string, label: string } | null>(null);

  // Email Server Settings State
  const [smtpSettings, setSmtpSettings] = useState<SmtpConfig>({
    host: 'smtp.gmail.com',
    port: '587',
    user: '',
    pass: '',
    from: '',
  });

  // Global Parameters State
  const [defaultStock, setDefaultStock] = useState<number>(20);
  const [adminFee, setAdminFee] = useState<number>(10);
  const [deliveryFee, setDeliveryFee] = useState<number>(2500);

  // Load Email Settings from Firestore
  const mailDocRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'settings', 'mail');
  }, [firestore]);
  const { data: savedMailSettings, isLoading: isLoadingMail } = useDoc<SmtpConfig>(mailDocRef);

  // Load Inventory/Params Settings from Firestore
  const paramsDocRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'settings', 'inventory');
  }, [firestore]);
  const { data: savedParams, isLoading: isLoadingParams } = useDoc<{ defaultStock: number, adminFee?: number, deliveryFee?: number }>(paramsDocRef);

  useEffect(() => {
    if (savedMailSettings) {
      setSmtpSettings({
        host: savedMailSettings.host || 'smtp.gmail.com',
        port: savedMailSettings.port || '587',
        user: savedMailSettings.user || '',
        pass: savedMailSettings.pass || '',
        from: savedMailSettings.from || '',
      });
    }
  }, [savedMailSettings]);

  useEffect(() => {
    if (savedParams) {
      setDefaultStock(savedParams.defaultStock ?? 20);
      setAdminFee(savedParams.adminFee ?? 10);
      setDeliveryFee(savedParams.deliveryFee ?? 2500);
    }
  }, [savedParams]);

  const handleSaveEmailSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore) return;
    
    setIsSavingEmail(true);
    try {
      await setDoc(doc(firestore, 'settings', 'mail'), smtpSettings);
      toast({
        title: "Konfigurasi Disimpan",
        description: "Pengaturan Mail Server telah berhasil diperbarui di database.",
      });
    } catch (error: any) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: 'settings/mail',
        operation: 'write',
        requestResourceData: smtpSettings
      }));
    } finally {
      setIsSavingEmail(false);
    }
  };

  const handleSaveParams = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore) return;
    
    setIsSavingParams(true);
    const data = { defaultStock, adminFee, deliveryFee };
    try {
      await setDoc(doc(firestore, 'settings', 'inventory'), data, { merge: true });
      toast({
        title: "Parameter Disimpan",
        description: "Seluruh parameter operasional telah berhasil diperbarui.",
      });
    } catch (error: any) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: 'settings/inventory',
        operation: 'write',
        requestResourceData: data
      }));
    } finally {
      setIsSavingParams(false);
    }
  };

  const handleTestEmail = async () => {
    if (!smtpSettings.user || !smtpSettings.user.includes('@') || !smtpSettings.pass) {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: "Silakan masukkan Username (Email) dan App Password yang valid.",
      });
      return;
    }

    setIsTestingEmail(true);
    try {
      const result = await sendSmtpEmail(smtpSettings, {
        to: smtpSettings.user,
        subject: "Test Pengiriman SMTP - TakjilKu",
        text: "Halo! Jika Anda menerima email ini, berarti konfigurasi SMTP Anda sudah berhasil diatur dengan benar.",
        html: "<h1>Test SMTP Berhasil!</h1><p>Halo! Jika Anda menerima email ini, berarti konfigurasi SMTP Anda sudah berhasil diatur dengan benar.</p>"
      });

      if (result.success) {
        toast({
          title: "Test Berhasil 📧",
          description: `Email percobaan telah dikirim ke ${smtpSettings.user}. Silakan cek kotak masuk atau folder spam Anda.`,
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      console.error("Test Email error:", error);
      toast({
        variant: "destructive",
        title: "Test Gagal",
        description: error.message || "Terjadi kesalahan. Pastikan App Password dan alamat From benar.",
      });
    } finally {
      setIsTestingEmail(false);
    }
  };

  const handleBackup = async () => {
    if (!firestore) return;
    setIsBackingUp(true);
    try {
      const backupData: any = {
        menuItems: [],
        vendors: [],
        settings: [],
        customers: [],
        orders: [],
        orderItems: []
      };

      const menuItemsSnap = await getDocs(collection(firestore, 'menuItems'));
      menuItemsSnap.forEach(d => backupData.menuItems.push({ id: d.id, ...d.data() }));

      const vendorsSnap = await getDocs(collection(firestore, 'vendors'));
      vendorsSnap.forEach(d => backupData.vendors.push({ id: d.id, ...d.data() }));

      const settingsSnap = await getDocs(collection(firestore, 'settings'));
      settingsSnap.forEach(d => backupData.settings.push({ id: d.id, ...d.data() }));

      const customersSnap = await getDocs(collection(firestore, 'customers'));
      customersSnap.forEach(d => backupData.customers.push({ id: d.id, ...d.data() }));

      const ordersSnap = await getDocs(query(collectionGroup(firestore, 'orders')));
      ordersSnap.forEach(d => {
        const pathParts = d.ref.path.split('/');
        const customerId = pathParts[1];
        backupData.orders.push({ customerId, id: d.id, data: d.data() });
      });

      const itemsSnap = await getDocs(query(collectionGroup(firestore, 'orderItems')));
      itemsSnap.forEach(d => {
        const pathParts = d.ref.path.split('/');
        const customerId = pathParts[1];
        const orderId = pathParts[3];
        backupData.orderItems.push({ customerId, orderId, id: d.id, data: d.data() });
      });

      const json = JSON.stringify(backupData, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `takjilku_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({ title: "Backup Berhasil", description: "Seluruh data sistem telah dicadangkan ke file JSON." });
    } catch (err: any) {
      console.error("Backup error:", err);
      toast({ variant: "destructive", title: "Backup Gagal", description: err.message });
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !firestore) return;

    setIsRestoring(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const backupData = JSON.parse(event.target?.result as string);
        const batch = writeBatch(firestore);

        if (backupData.menuItems) {
          backupData.menuItems.forEach((item: any) => {
            const { id, ...data } = item;
            batch.set(doc(firestore, 'menuItems', id), data);
          });
        }

        if (backupData.vendors) {
          backupData.vendors.forEach((v: any) => {
            const { id, ...data } = v;
            batch.set(doc(firestore, 'vendors', id), data);
          });
        }

        if (backupData.settings) {
          backupData.settings.forEach((s: any) => {
            const { id, ...data } = s;
            batch.set(doc(firestore, 'settings', id), data);
          });
        }

        if (backupData.customers) {
          backupData.customers.forEach((c: any) => {
            const { id, ...data } = c;
            batch.set(doc(firestore, 'customers', id), data);
          });
        }

        if (backupData.orders) {
          backupData.orders.forEach((o: any) => {
            const { customerId, id, data } = o;
            batch.set(doc(firestore, 'customers', customerId, 'orders', id), data);
          });
        }

        if (backupData.orderItems) {
          backupData.orderItems.forEach((oi: any) => {
            const { customerId, orderId, id, data } = oi;
            batch.set(doc(firestore, 'customers', customerId, 'orders', orderId, 'orderItems', id), data);
          });
        }

        await batch.commit();
        toast({ title: "Restore Berhasil", description: "Data sistem telah dipulihkan dari file backup." });
      } catch (err: any) {
        console.error("Restore error:", err);
        toast({ variant: "destructive", title: "Restore Gagal", description: "Format file tidak valid atau terjadi kesalahan database." });
      } finally {
        setIsRestoring(false);
        if (restoreFileInputRef.current) restoreFileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const executeClear = async () => {
    if (!firestore || !actionTarget) return;
    setIsDeleting(true);
    
    try {
      const batch = writeBatch(firestore);
      
      if (actionTarget.id === 'ALL') {
        const allPaths = TABLES.filter(t => t.id !== 'settings').map(t => t.id);
        for (const path of allPaths) {
          let q;
          if (['orders', 'orderItems'].includes(path)) {
            q = query(collectionGroup(firestore, path));
          } else {
            q = query(collection(firestore, path));
          }
          const snapshot = await getDocs(q);
          snapshot.docs.forEach(d => batch.delete(d.ref));
        }
      } else {
        let q;
        if (['orders', 'orderItems'].includes(actionTarget.id)) {
          q = query(collectionGroup(firestore, actionTarget.id));
        } else {
          q = query(collection(firestore, actionTarget.id));
        }
        const snapshot = await getDocs(q);
        snapshot.docs.forEach(d => batch.delete(d.ref));
      }

      await batch.commit();
      toast({
        title: "Pembersihan Berhasil",
        description: `Seluruh data pada ${actionTarget.label} telah dihapus selamanya.`,
      });
    } catch (error: any) {
      console.error(`Error clearing ${actionTarget.label}:`, error);
      toast({ variant: 'destructive', title: 'Gagal', description: 'Terjadi kesalahan hak akses saat menghapus data.' });
    } finally {
      setIsDeleting(false);
      setActionTarget(null);
      setConfirmInput('');
    }
  };

  if (isLoadingMail || isLoadingParams) {
    return <div className="flex h-full items-center justify-center p-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-headline">Pengaturan Sistem</h1>
        <p className="text-muted-foreground">Kelola konfigurasi pengiriman email, parameter operasional, dan pemeliharaan data.</p>
      </div>

      <Tabs defaultValue="mail" className="w-full">
        <TabsList className="grid w-full grid-cols-4 max-w-xl">
          <TabsTrigger value="mail" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Mail Server
          </TabsTrigger>
          <TabsTrigger value="params" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Set Parameter
          </TabsTrigger>
          <TabsTrigger value="data" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Maintenance
          </TabsTrigger>
          <TabsTrigger value="backup" className="flex items-center gap-2">
            <FileJson className="h-4 w-4" />
            Backup
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mail" className="space-y-4 pt-4">
          <Alert className="bg-primary/5 border-primary/20">
            <Info className="h-4 w-4 text-primary" />
            <AlertTitle className="font-bold flex items-center gap-2">
              Panduan Penting Gmail SMTP
            </AlertTitle>
            <AlertDescription className="text-sm space-y-2">
              <p>Pengaturan ini <strong>TIDAK</strong> berada di menu Settings Gmail, melainkan di halaman <strong>Akun Google</strong> Anda:</p>
              <ol className="list-decimal pl-5 space-y-2">
                <li>Buka <Link href="https://myaccount.google.com/security" target="_blank" className="font-bold underline inline-flex items-center gap-1">Keamanan Akun Google <ExternalLink className="h-3 w-3" /></Link>.</li>
                <li>Aktifkan <strong>Verifikasi 2 Langkah</strong> (Wajib).</li>
                <li>Cari menu <strong>&quot;App Passwords&quot;</strong> melalui kotak pencarian di bagian atas halaman Akun Google.</li>
                <li>Buat password baru (beri nama &quot;TakjilKu&quot;), lalu gunakan kode <strong>16 digit</strong> yang muncul sebagai Password di form bawah ini.</li>
              </ol>
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle>Konfigurasi SMTP</CardTitle>
              <CardDescription>
                Atur server SMTP untuk mengirimkan struk PDF secara otomatis.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveEmailSettings} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="smtp-host">SMTP Host</Label>
                    <Input 
                      id="smtp-host" 
                      value={smtpSettings.host} 
                      onChange={(e) => setSmtpSettings({...smtpSettings, host: e.target.value})}
                      placeholder="e.g. smtp.gmail.com" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtp-port">Port</Label>
                    <Input 
                      id="smtp-port" 
                      value={smtpSettings.port} 
                      onChange={(e) => setSmtpSettings({...smtpSettings, port: e.target.value})}
                      placeholder="e.g. 587 atau 465" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtp-user">Username / Email</Label>
                    <Input 
                      id="smtp-user" 
                      value={smtpSettings.user} 
                      onChange={(e) => setSmtpSettings({...smtpSettings, user: e.target.value})}
                      placeholder="email@gmail.com" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtp-pass">Password / App Password</Label>
                    <Input 
                      id="smtp-pass" 
                      type="password" 
                      value={smtpSettings.pass} 
                      onChange={(e) => setSmtpSettings({...smtpSettings, pass: e.target.value})}
                      placeholder="Gunakan kode 16 digit App Password" 
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="smtp-from">Email Pengirim (From Display Name)</Label>
                    <Input 
                      id="smtp-from" 
                      value={smtpSettings.from} 
                      onChange={(e) => setSmtpSettings({...smtpSettings, from: e.target.value})}
                      placeholder="Isi Nama Toko (Contoh: TakjilKu)" 
                    />
                    <p className="text-[10px] text-muted-foreground italic">
                      Tips: Isi dengan nama toko Anda. Sistem akan otomatis menyertakan email utama Anda di belakang nama tersebut.
                    </p>
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={handleTestEmail} 
                    disabled={isTestingEmail || isSavingEmail}
                  >
                    {isTestingEmail ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Test Email
                  </Button>
                  <Button type="submit" disabled={isSavingEmail || isTestingEmail}>
                    {isSavingEmail ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Simpan Konfigurasi
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="params" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Parameter Operasional</CardTitle>
              <CardDescription>
                Tentukan nilai-nilai dasar yang digunakan untuk operasional harian.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveParams} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
                  <div className="space-y-2 p-4 border rounded-lg bg-muted/10">
                    <Label htmlFor="default-stock" className="font-bold flex items-center gap-2">
                      <Package className="h-4 w-4 text-primary" />
                      Angka Stok Default
                    </Label>
                    <Input 
                      id="default-stock" 
                      type="number" 
                      min="0"
                      value={defaultStock} 
                      onChange={(e) => setDefaultStock(Number(e.target.value))}
                      placeholder="Contoh: 20" 
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Digunakan saat melakukan "Reset Stok" di halaman Manajemen Menu.
                    </p>
                  </div>

                  <div className="space-y-2 p-4 border rounded-lg bg-muted/10">
                    <Label htmlFor="admin-fee" className="font-bold flex items-center gap-2 text-destructive">
                      <AlertTriangle className="h-4 w-4" />
                      Potongan Admin (%)
                    </Label>
                    <div className="relative">
                      <Input 
                        id="admin-fee" 
                        type="number" 
                        min="0"
                        max="100"
                        value={adminFee} 
                        onChange={(e) => setAdminFee(Number(e.target.value))}
                        placeholder="Contoh: 10" 
                        className="pr-8"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">%</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Persentase biaya administrasi yang dipotong dari total penjualan kotor per mitra.
                    </p>
                  </div>

                  <div className="space-y-2 p-4 border rounded-lg bg-muted/10 md:col-span-2">
                    <Label htmlFor="delivery-fee" className="font-bold flex items-center gap-2 text-blue-600">
                      <Truck className="h-4 w-4" />
                      Biaya Ongkos Antar (Rp)
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">Rp</span>
                      <Input 
                        id="delivery-fee" 
                        type="number" 
                        min="0"
                        value={deliveryFee} 
                        onChange={(e) => setDeliveryFee(Number(e.target.value))}
                        placeholder="Contoh: 2500" 
                        className="pl-10"
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Biaya pengiriman tetap (flat) yang dikenakan untuk setiap satu kali pesanan.
                    </p>
                  </div>
                </div>
                
                <Button type="submit" disabled={isSavingParams} className="w-full md:w-auto px-12">
                  {isSavingParams ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Simpan Semua Parameter
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data" className="space-y-4 pt-4">
          <Card className="border-destructive/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Zona Berbahaya (Maintenance)
              </CardTitle>
              <CardDescription>
                Kosongkan data tabel secara permanen. Tindakan ini memerlukan konfirmasi kata kunci.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {TABLES.map((table) => (
                  <div key={table.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors">
                    <div className="space-y-0.5">
                      <h4 className="text-sm font-bold">{table.label}</h4>
                      <p className="text-xs text-muted-foreground">{table.description}</p>
                    </div>
                    {table.id !== 'settings' && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-destructive border-destructive/20 hover:bg-destructive/10"
                        onClick={() => setActionTarget(table)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <div className="pt-6 border-t">
                <Button 
                  variant="destructive" 
                  className="w-full flex items-center gap-2 h-12 text-lg font-bold"
                  onClick={() => setActionTarget({ id: 'ALL', label: 'SEMUA TABEL DATA (Kecuali Pengaturan)' })}
                >
                  <Skull className="h-5 w-5" />
                  HAPUS SELURUH ISI DATABASE
                </Button>
                <p className="text-center text-[10px] text-muted-foreground mt-2 italic">
                  *Tindakan ini akan mengosongkan Menu, Mitra, Pelanggan, dan Pesanan. Tabel Pengaturan Sistem diproteksi.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="backup" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Ekspor &amp; Impor Data (JSON)</CardTitle>
              <CardDescription>
                Cadangkan seluruh data sistem ke dalam file JSON atau pulihkan data.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 border rounded-lg gap-4">
                <div className="space-y-1">
                  <h4 className="font-bold flex items-center gap-2">
                    <Download className="h-4 w-4 text-primary" />
                    Pencadangan Penuh
                  </h4>
                  <p className="text-sm text-muted-foreground">Unduh seluruh Menu, Mitra, Pelanggan, Pengaturan, dan Riwayat Pesanan.</p>
                </div>
                <Button onClick={handleBackup} disabled={isBackingUp} className="min-w-[150px]">
                  {isBackingUp ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                  Unduh Backup
                </Button>
              </div>

              <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 border rounded-lg gap-4">
                <div className="space-y-1">
                  <h4 className="font-bold flex items-center gap-2">
                    <Upload className="h-4 w-4 text-green-600" />
                    Pemulihan Data
                  </h4>
                  <p className="text-sm text-muted-foreground">Unggah file backup JSON untuk memulihkan data.</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    ref={restoreFileInputRef}
                    onChange={handleRestore}
                  />
                  <Button 
                    variant="outline" 
                    onClick={() => restoreFileInputRef.current?.click()} 
                    disabled={isRestoring}
                    className="border-green-600 text-green-600 hover:bg-green-50 min-w-[150px]"
                  >
                    {isRestoring ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                    Unggah Backup
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Security Confirmation Dialog */}
      <AlertDialog open={!!actionTarget} onOpenChange={(open) => !open && setActionTarget(null)}>
        <AlertDialogContent className="border-destructive/50">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Konfirmasi Penghapusan Permanen
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4" asChild>
              <div className="space-y-4">
                <p>
                  Anda akan menghapus seluruh data pada <strong>{actionTarget?.label}</strong>. 
                  Data yang sudah dihapus tidak dapat dikembalikan lagi.
                </p>
                <div className="p-3 bg-destructive/10 rounded-md border border-destructive/20 space-y-2">
                  <Label className="text-destructive font-bold text-xs uppercase">Ketik "HAPUS" untuk melanjutkan:</Label>
                  <Input 
                    value={confirmInput} 
                    onChange={(e) => setConfirmInput(e.target.value)} 
                    placeholder="Ketik HAPUS di sini..."
                    className="bg-background border-destructive/30 focus-visible:ring-destructive"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setConfirmInput(''); setActionTarget(null); }}>Batal</AlertDialogCancel>
            <AlertDialogAction 
              onClick={executeClear} 
              disabled={confirmInput !== 'HAPUS' || isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Ya, Hapus Sekarang
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
