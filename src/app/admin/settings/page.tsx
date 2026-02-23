'use client';

import { useState, useEffect, useRef } from 'react';
import { useFirestore, errorEmitter, FirestorePermissionError, useDoc, useMemoFirebase } from '@/firebase';
import { collection, getDocs, writeBatch, query, collectionGroup, doc, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Mail, Database, Trash2, Save, AlertTriangle, Send, Info, Download, Upload, FileJson, Package, Skull, Truck, MessageSquare, Code, Play, Key, LayoutGrid, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { sendSmtpEmail, sendWhatsAppWebhook, type SmtpConfig } from '@/app/actions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs as TabsUI, TabsContent as TabsContentUI, TabsList as TabsListUI, TabsTrigger as TabsTriggerUI } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

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
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [isSavingParams, setIsSavingParams] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const restoreFileInputRef = useRef<HTMLInputElement>(null);

  const [confirmInput, setConfirmInput] = useState('');
  const [actionTarget, setActionTarget] = useState<{ id: string, label: string } | null>(null);

  const [smtpSettings, setSmtpSettings] = useState<SmtpConfig>({
    host: 'smtp.gmail.com',
    port: '587',
    user: '',
    pass: '',
    from: '',
  });

  const [defaultStock, setDefaultStock] = useState<number>(20);
  const [adminFee, setAdminFee] = useState<number>(10);
  const [deliveryFee, setDeliveryFee] = useState<number>(2500);
  const [whatsappWebhookUrl, setWhatsappWebhookUrl] = useState<string>('');
  const [whatsappApiToken, setWhatsappApiToken] = useState<string>('');
  const [menuDisplayMode, setMenuDisplayMode] = useState<string>('category');
  const [testPhone, setTestPhone] = useState<string>('6281234567890');

  // Visibility toggles
  const [showActiveMenu, setShowActiveMenu] = useState<boolean>(true);
  const [showInactiveMenu, setShowInactiveMenu] = useState<boolean>(false);
  const [showActiveVendor, setShowActiveVendor] = useState<boolean>(true);
  const [showInactiveVendor, setShowInactiveVendor] = useState<boolean>(false);

  const mailDocRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'settings', 'mail');
  }, [firestore]);
  const { data: savedMailSettings, isLoading: isLoadingMail } = useDoc<SmtpConfig>(mailDocRef);

  const paramsDocRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'settings', 'inventory');
  }, [firestore]);
  const { data: savedParams, isLoading: isLoadingParams } = useDoc<{ 
    defaultStock: number, 
    adminFee?: number, 
    deliveryFee?: number, 
    whatsappWebhookUrl?: string,
    whatsappApiToken?: string,
    menuDisplayMode?: string,
    showActiveMenu?: boolean,
    showInactiveMenu?: boolean,
    showActiveVendor?: boolean,
    showInactiveVendor?: boolean
  }>(paramsDocRef);

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
      setWhatsappWebhookUrl(savedParams.whatsappWebhookUrl || '');
      setWhatsappApiToken(savedParams.whatsappApiToken || '');
      setMenuDisplayMode(savedParams.menuDisplayMode || 'category');
      setShowActiveMenu(savedParams.showActiveMenu ?? true);
      setShowInactiveMenu(savedParams.showInactiveMenu ?? false);
      setShowActiveVendor(savedParams.showActiveVendor ?? true);
      setShowInactiveVendor(savedParams.showInactiveVendor ?? false);
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
    const data = { 
      defaultStock, 
      adminFee, 
      deliveryFee, 
      whatsappWebhookUrl, 
      whatsappApiToken, 
      menuDisplayMode,
      showActiveMenu,
      showInactiveMenu,
      showActiveVendor,
      showInactiveVendor
    };
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
      toast({
        variant: "destructive",
        title: "Test Gagal",
        description: error.message || "Terjadi kesalahan. Pastikan App Password dan alamat From benar.",
      });
    } finally {
      setIsTestingEmail(false);
    }
  };

  const handleTestWebhook = async () => {
    if (!whatsappWebhookUrl) {
      toast({ variant: "destructive", title: "URL Kosong", description: "Masukkan URL API Send terlebih dahulu." });
      return;
    }

    if (whatsappWebhookUrl.includes('takjilku.netlify.app')) {
      toast({ 
        variant: "destructive", 
        title: "URL Salah!", 
        description: "Anda memasukkan URL web sendiri. Gunakan URL API dari Wasender." 
      });
      return;
    }

    setIsTestingWebhook(true);
    const dummyPayload = {
      to: testPhone,
      text: "Halo! Ini adalah pesan percobaan dari sistem TakjilKu untuk memastikan koneksi WhatsApp API sudah aktif.",
      orderId: "TEST-123",
      customerName: "Tes Admin"
    };

    try {
      const result = await sendWhatsAppWebhook(whatsappWebhookUrl, dummyPayload, whatsappApiToken);
      if (result.success) {
        toast({ title: "Berhasil Terkirim ✅", description: "Pesan percobaan berhasil diterima oleh API Provider." });
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      toast({ 
        variant: "destructive", 
        title: "Gagal", 
        description: error.message
      });
    } finally {
      setIsTestingWebhook(false);
    }
  };

  const handleBackup = async () => {
    if (!firestore) return;
    setIsBackingUp(true);
    try {
      const backupData: any = {
        menuItems: [], vendors: [], settings: [], customers: [], orders: [], orderItems: []
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
        backupData.orders.push({ customerId: pathParts[1], id: d.id, data: d.data() });
      });

      const itemsSnap = await getDocs(query(collectionGroup(firestore, 'orderItems')));
      itemsSnap.forEach(d => {
        const pathParts = d.ref.path.split('/');
        backupData.orderItems.push({ customerId: pathParts[1], orderId: pathParts[3], id: d.id, data: d.data() });
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

        if (backupData.menuItems) backupData.menuItems.forEach((item: any) => { const { id, ...data } = item; batch.set(doc(firestore, 'menuItems', id), data); });
        if (backupData.vendors) backupData.vendors.forEach((v: any) => { const { id, ...data } = v; batch.set(doc(firestore, 'vendors', id), data); });
        if (backupData.settings) backupData.settings.forEach((s: any) => { const { id, ...data } = s; batch.set(doc(firestore, 'settings', id), data); });
        if (backupData.customers) backupData.customers.forEach((c: any) => { const { id, ...data } = c; batch.set(doc(firestore, 'customers', id), data); });
        if (backupData.orders) backupData.orders.forEach((o: any) => { batch.set(doc(firestore, 'customers', o.customerId, 'orders', o.id), o.data); });
        if (backupData.orderItems) backupData.orderItems.forEach((oi: any) => { batch.set(doc(firestore, 'customers', oi.customerId, 'orders', oi.orderId, 'orderItems', oi.id), oi.data); });

        await batch.commit();
        toast({ title: "Restore Berhasil", description: "Data sistem telah dipulihkan dari file backup." });
      } catch (err: any) {
        toast({ variant: "destructive", title: "Restore Gagal", description: "Format file tidak valid." });
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
          let q = ['orders', 'orderItems'].includes(path) ? query(collectionGroup(firestore, path)) : query(collection(firestore, path));
          const snapshot = await getDocs(q);
          snapshot.docs.forEach(d => batch.delete(d.ref));
        }
      } else {
        let q = ['orders', 'orderItems'].includes(actionTarget.id) ? query(collectionGroup(firestore, actionTarget.id)) : query(collection(firestore, actionTarget.id));
        const snapshot = await getDocs(q);
        snapshot.docs.forEach(d => batch.delete(d.ref));
      }
      await batch.commit();
      toast({ title: "Pembersihan Berhasil", description: `Data ${actionTarget.label} telah dihapus.` });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Gagal', description: 'Kesalahan hak akses.' });
    } finally {
      setIsDeleting(false);
      setActionTarget(null);
      setConfirmInput('');
    }
  };

  if (isLoadingMail || isLoadingParams) {
    return <div className="flex h-full items-center justify-center p-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const isInvalidWaUrl = whatsappWebhookUrl.includes('takjilku.netlify.app');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-headline">Pengaturan Sistem</h1>
        <p className="text-muted-foreground">Kelola konfigurasi pengiriman email, parameter operasional, dan pemeliharaan data.</p>
      </div>

      <TabsUI defaultValue="params" className="w-full">
        <TabsListUI className="grid w-full grid-cols-4 max-w-xl">
          <TabsTriggerUI value="params" className="flex items-center gap-2">
            <Package className="h-4 w-4" /> Set Parameter
          </TabsTriggerUI>
          <TabsTriggerUI value="mail" className="flex items-center gap-2">
            <Mail className="h-4 w-4" /> Mail Server
          </TabsTriggerUI>
          <TabsTriggerUI value="backup" className="flex items-center gap-2">
            <FileJson className="h-4 w-4" /> Backup
          </TabsTriggerUI>
          <TabsTriggerUI value="data" className="flex items-center gap-2">
            <Database className="h-4 w-4" /> Maintenance
          </TabsTriggerUI>
        </TabsListUI>

        <TabsContentUI value="params" className="space-y-4 pt-4">
          <Card>
            <CardHeader><CardTitle>Parameter Operasional</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleSaveParams} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
                  {/* Menu Display Settings */}
                  <div className="space-y-4 p-4 border rounded-lg bg-orange-50/50 border-orange-200 col-span-1 md:col-span-2">
                    <Label className="font-bold flex items-center gap-2 text-orange-700">
                      <LayoutGrid className="h-4 w-4" /> Tampilan Menu Pelanggan
                    </Label>
                    <Select value={menuDisplayMode} onValueChange={setMenuDisplayMode}>
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Pilih Mode Tampilan" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="group">
                          <div className="flex items-center gap-2">
                            <LayoutGrid className="h-4 w-4" />
                            <span>Berdasarkan Grup Kategori (Makanan Utama, Minuman, Snack)</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="category">
                          <div className="flex items-center gap-2">
                            <Eye className="h-4 w-4" />
                            <span>Berdasarkan Kategori (Master Kategori)</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="none">
                          <div className="flex items-center gap-2">
                            <EyeOff className="h-4 w-4" />
                            <span>Tidak Menampilkan (Daftar Langsung)</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    
                    {/* Visibility Filters */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-orange-200/50">
                      <div className="flex items-center space-x-2">
                        <Checkbox id="showActiveMenu" checked={showActiveMenu} onCheckedChange={(checked) => setShowActiveMenu(!!checked)} />
                        <label htmlFor="showActiveMenu" className="text-xs font-medium leading-none cursor-pointer">Tampilkan Menu Aktif</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox id="showInactiveMenu" checked={showInactiveMenu} onCheckedChange={(checked) => setShowInactiveMenu(!!checked)} />
                        <label htmlFor="showInactiveMenu" className="text-xs font-medium leading-none cursor-pointer">Tampilkan Menu Tidak Aktif</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox id="showActiveVendor" checked={showActiveVendor} onCheckedChange={(checked) => setShowActiveVendor(!!checked)} />
                        <label htmlFor="showActiveVendor" className="text-xs font-medium leading-none cursor-pointer">Tampilkan Mitra Aktif</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox id="showInactiveVendor" checked={showInactiveVendor} onCheckedChange={(checked) => setShowInactiveVendor(!!checked)} />
                        <label htmlFor="showInactiveVendor" className="text-xs font-medium leading-none cursor-pointer">Tampilkan Mitra Tidak Aktif</label>
                      </div>
                    </div>

                    <p className="text-[10px] text-muted-foreground mt-1 italic">
                      * Menu "Tidak Aktif" adalah menu yang statusnya diset OFF oleh Admin atau Mitra.
                    </p>
                  </div>

                  <div className="space-y-2 p-4 border rounded-lg bg-muted/10">
                    <Label htmlFor="default-stock" className="font-bold flex items-center gap-2"><Package className="h-4 w-4 text-primary" /> Angka Stok Default</Label>
                    <Input id="default-stock" type="number" value={defaultStock} onChange={(e) => setDefaultStock(Number(e.target.value))} />
                  </div>
                  <div className="space-y-2 p-4 border rounded-lg bg-muted/10">
                    <Label htmlFor="admin-fee" className="font-bold flex items-center gap-2 text-destructive"><AlertTriangle className="h-4 w-4" /> Potongan Admin (%)</Label>
                    <Input id="admin-fee" type="number" value={adminFee} onChange={(e) => setAdminFee(Number(e.target.value))} />
                  </div>
                  <div className="space-y-2 p-4 border rounded-lg bg-muted/10">
                    <Label htmlFor="delivery-fee" className="font-bold flex items-center gap-2 text-blue-600"><Truck className="h-4 w-4" /> Ongkir (Rp)</Label>
                    <Input id="delivery-fee" type="number" value={deliveryFee} onChange={(e) => setDeliveryFee(Number(e.target.value))} />
                  </div>
                  <div className="space-y-2 p-4 border rounded-lg bg-muted/10">
                    <Label htmlFor="wa-webhook" className="font-bold flex items-center gap-2 text-green-600"><MessageSquare className="h-4 w-4" /> WhatsApp API URL (Kirim)</Label>
                    <Input id="wa-webhook" type="url" value={whatsappWebhookUrl} onChange={(e) => setWhatsappWebhookUrl(e.target.value)} placeholder="https://wasenderapi.com/api/send-message" className={cn(isInvalidWaUrl && "border-destructive")} />
                    {isInvalidWaUrl && <p className="text-destructive text-[10px] font-bold">SALAH URL! Gunakan URL Provider, bukan web ini.</p>}
                    
                    <div className="mt-3">
                      <Label htmlFor="wa-token" className="font-bold flex items-center gap-2 text-green-600 text-xs uppercase"><Key className="h-3 w-3" /> API Key</Label>
                      <Input id="wa-token" type="password" value={whatsappApiToken} onChange={(e) => setWhatsappApiToken(e.target.value)} className="h-8 text-xs" />
                    </div>

                    <div className="mt-4 pt-4 border-t border-dashed">
                      <Label className="text-[10px] font-bold uppercase text-muted-foreground">Nomor HP Tes Pengiriman</Label>
                      <div className="flex gap-2 mt-1">
                        <Input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="6281..." className="h-8 text-xs flex-1" />
                        <Button type="button" variant="secondary" size="sm" className="h-8 text-[10px]" onClick={handleTestWebhook} disabled={isTestingWebhook || !whatsappWebhookUrl}>
                          {isTestingWebhook ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Play className="h-3 w-3 mr-1" />} TEST
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
                <Button type="submit" disabled={isSavingParams} className="w-full md:w-auto px-12">
                  {isSavingParams ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Simpan Parameter
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContentUI>

        <TabsContentUI value="mail" className="space-y-4 pt-4">
          <Card>
            <CardHeader><CardTitle>Konfigurasi SMTP</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleSaveEmailSettings} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>SMTP Host</Label><Input value={smtpSettings.host} onChange={(e) => setSmtpSettings({...smtpSettings, host: e.target.value})} /></div>
                  <div className="space-y-2"><Label>Port</Label><Input value={smtpSettings.port} onChange={(e) => setSmtpSettings({...smtpSettings, port: e.target.value})} /></div>
                  <div className="space-y-2"><Label>Username</Label><Input value={smtpSettings.user} onChange={(e) => setSmtpSettings({...smtpSettings, user: e.target.value})} /></div>
                  <div className="space-y-2"><Label>App Password</Label><Input type="password" value={smtpSettings.pass} onChange={(e) => setSmtpSettings({...smtpSettings, pass: e.target.value})} /></div>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={handleTestEmail} disabled={isTestingEmail}><Send className="mr-2 h-4 w-4" /> Test</Button>
                  <Button type="submit" disabled={isSavingEmail}><Save className="mr-2 h-4 w-4" /> Simpan</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContentUI>

        <TabsContentUI value="backup" className="space-y-4 pt-4">
          <Card>
            <CardHeader><CardTitle>Backup & Restore</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="flex justify-between items-center p-4 border rounded-lg">
                <div className="space-y-1"><h4 className="font-bold">Unduh Database</h4><p className="text-sm text-muted-foreground">Simpan data ke file JSON.</p></div>
                <Button onClick={handleBackup} disabled={isBackingUp}><Download className="mr-2 h-4 w-4" /> Unduh</Button>
              </div>
              <div className="flex justify-between items-center p-4 border rounded-lg">
                <div className="space-y-1"><h4 className="font-bold">Pulihkan Data</h4><p className="text-sm text-muted-foreground">Unggah file JSON cadangan.</p></div>
                <input type="file" accept=".json" className="hidden" ref={restoreFileInputRef} onChange={handleRestore} />
                <Button variant="outline" onClick={() => restoreFileInputRef.current?.click()} disabled={isRestoring}><Upload className="mr-2 h-4 w-4" /> Ambil File</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContentUI>

        <TabsContentUI value="data" className="space-y-4 pt-4">
          <Card className="border-destructive/20">
            <CardHeader><CardTitle className="text-destructive">Zona Berbahaya</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {TABLES.map((table) => table.id !== 'settings' && (
                  <div key={table.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-0.5"><h4 className="text-sm font-bold">{table.label}</h4></div>
                    <Button variant="outline" size="sm" className="text-destructive border-destructive/20" onClick={() => setActionTarget(table)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
              <Button variant="destructive" className="w-full mt-6" onClick={() => setActionTarget({ id: 'ALL', label: 'SEMUA TABEL DATA' })}><Skull className="h-5 w-5 mr-2" /> HAPUS SELURUH ISI DATABASE</Button>
            </CardContent>
          </Card>
        </TabsContentUI>
      </TabsUI>

      <AlertDialog open={!!actionTarget} onOpenChange={(open) => !open && setActionTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle className="text-destructive">Konfirmasi Penghapusan</AlertDialogTitle><AlertDialogDescription>Ketik <strong>HAPUS</strong> untuk menghapus {actionTarget?.label}.</AlertDialogDescription></AlertDialogHeader>
          <div className="p-4 pt-0"><Input value={confirmInput} onChange={(e) => setConfirmInput(e.target.value)} placeholder="Ketik HAPUS..." /></div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setConfirmInput(''); setActionTarget(null); }}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={executeClear} disabled={confirmInput !== 'HAPUS' || isDeleting} className="bg-destructive">Ya, Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
