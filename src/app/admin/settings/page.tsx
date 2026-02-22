'use client';

import { useState, useEffect, useRef } from 'react';
import { useFirestore, errorEmitter, FirestorePermissionError, useDoc, useMemoFirebase } from '@/firebase';
import { collection, getDocs, writeBatch, query, collectionGroup, doc, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Mail, Database, Trash2, Save, AlertTriangle, Send, Info, ExternalLink, Download, Upload, FileJson, Package, Skull, Truck, MessageSquare, Code, Play, Key, Globe, AlertCircle, XCircle, Clock } from 'lucide-react';
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
import Link from 'next/link';
import { Tabs as TabsUI, TabsContent as TabsContentUI, TabsList as TabsListUI, TabsTrigger as TabsTriggerUI } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
  const [showPayload, setShowPayload] = useState(false);
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
    whatsappApiToken?: string 
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
    const data = { defaultStock, adminFee, deliveryFee, whatsappWebhookUrl, whatsappApiToken };
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
        description: "Anda memasukkan URL web sendiri. Gunakan URL API dari Wasender (misal: https://wasenderapi.com/api/send-message)." 
      });
      return;
    }

    setIsTestingWebhook(true);
    const dummyPayload = {
      to: "6281234567890", 
      text: "Halo! Ini adalah pesan percobaan dari sistem TakjilKu.",
      orderId: "TEST-123",
      customerName: "Tes Admin",
      totalAmount: 25000
    };

    try {
      const result = await sendWhatsAppWebhook(whatsappWebhookUrl, dummyPayload, whatsappApiToken);
      if (result.success) {
        toast({ title: "Berhasil Terkirim ✅", description: "Pesan percobaan berhasil diterima oleh API Provider." });
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      const isRateLimit = error.message.includes("Trial") || error.message.includes("minute");
      toast({ 
        variant: "destructive", 
        title: isRateLimit ? "Tunggu Sebentar ⏳" : "Gagal", 
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
            <Package className="h-4 w-4" />
            Set Parameter
          </TabsTriggerUI>
          <TabsTriggerUI value="mail" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Mail Server
          </TabsTriggerUI>
          <TabsTriggerUI value="backup" className="flex items-center gap-2">
            <FileJson className="h-4 w-4" />
            Backup
          </TabsTriggerUI>
          <TabsTriggerUI value="data" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Maintenance
          </TabsTriggerUI>
        </TabsListUI>

        <TabsContentUI value="params" className="space-y-4 pt-4">
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
                    />
                    <p className="text-[10px] text-muted-foreground">Digunakan saat melakukan "Reset Stok" di halaman Menu.</p>
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
                        min="0" max="100"
                        value={adminFee} 
                        onChange={(e) => setAdminFee(Number(e.target.value))}
                        className="pr-8"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">%</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Potongan biaya administrasi per mitra.</p>
                  </div>

                  <div className="space-y-2 p-4 border rounded-lg bg-muted/10">
                    <Label htmlFor="delivery-fee" className="font-bold flex items-center gap-2 text-blue-600">
                      <Truck className="h-4 w-4" />
                      Biaya Ongkos Antar (Rp)
                    </Label>
                    <div className="relative">
                      <Input 
                        id="delivery-fee" 
                        type="number" 
                        min="0"
                        value={deliveryFee} 
                        onChange={(e) => setDeliveryFee(Number(e.target.value))}
                        className="pl-10"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">Rp</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Biaya pengiriman tetap per pesanan.</p>
                  </div>

                  <div className="space-y-2 p-4 border rounded-lg bg-muted/10">
                    <Label htmlFor="wa-webhook" className="font-bold flex items-center gap-2 text-green-600">
                      <MessageSquare className="h-4 w-4" />
                      URL API PROVIDER (Tujuan Kirim Pesan)
                    </Label>
                    <div className="flex gap-2">
                      <Input 
                        id="wa-webhook" 
                        type="url"
                        value={whatsappWebhookUrl} 
                        onChange={(e) => setWhatsappWebhookUrl(e.target.value)}
                        placeholder="https://wasenderapi.com/api/send-message"
                        className={cn("flex-1", isInvalidWaUrl && "border-destructive ring-destructive")}
                      />
                      <Button 
                        type="button" 
                        variant="secondary" 
                        size="icon" 
                        onClick={handleTestWebhook} 
                        disabled={isTestingWebhook || !whatsappWebhookUrl}
                      >
                        {isTestingWebhook ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                      </Button>
                    </div>
                    
                    {isInvalidWaUrl && (
                      <div className="flex items-center gap-1.5 text-destructive text-[10px] font-bold uppercase mt-1 animate-pulse">
                        <XCircle className="h-3 w-3" />
                        Salah URL! Gunakan URL Wasender, bukan web ini.
                      </div>
                    )}

                    <div className="mt-3 space-y-2">
                      <Label htmlFor="wa-token" className="font-bold flex items-center gap-2 text-green-600 text-xs uppercase">
                        <Key className="h-3 w-3" /> API Key (Dari Session WA 🔑)
                      </Label>
                      <Input 
                        id="wa-token" 
                        type="password"
                        value={whatsappApiToken} 
                        onChange={(e) => setWhatsappApiToken(e.target.value)}
                        placeholder="Masukkan API Key dari Wasender"
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className="bg-orange-500/10 p-2 rounded flex gap-2 border border-orange-500/20 mt-2">
                      <AlertCircle className="h-3 w-3 text-orange-600 shrink-0 mt-0.5" />
                      <div className="text-[9px] text-orange-700 leading-tight space-y-1">
                        <p><strong>Penting:</strong> Akun Trial memiliki limit 1 pesan / menit.</p>
                        <p><strong>Tips:</strong> Klik ikon kunci (🔑) di dashboard Wasender untuk ambil API Key.</p>
                      </div>
                    </div>

                    <Collapsible open={showPayload} onOpenChange={setShowPayload} className="mt-2">
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 text-[9px] font-bold uppercase gap-1 px-0">
                          <Code className="h-3 w-3" /> {showPayload ? 'Sembunyikan' : 'Lihat'} Payload Gateway
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2">
                        <div className="bg-slate-950 text-slate-50 p-3 rounded-md font-mono text-[10px] overflow-auto max-h-40">
                          <pre>{JSON.stringify({
                            to: "628...",
                            text: "Halo [Nama]...", 
                            api_key: "...",
                            orderId: "...",
                            customerName: "..."
                          }, null, 2)}</pre>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                </div>
                
                <Alert className="bg-orange-50 border-orange-200 mt-4 shadow-sm">
                  <Globe className="h-4 w-4 text-orange-600" />
                  <AlertTitle className="text-xs font-bold text-orange-800 uppercase">Sinkronisasi WasenderAPI (Receiver)</AlertTitle>
                  <AlertDescription className="text-[11px] text-orange-700 leading-relaxed space-y-2">
                    <p>Agar aplikasi bisa menerima status pesan terupdate (Diterima/Dibaca):</p>
                    <ol className="list-decimal pl-4 space-y-1">
                      <li>Di dashboard Wasender, cari menu <strong>Webhook Configuration</strong>.</li>
                      <li>Tempel URL di bawah ini ke kolom <strong>"Destination for POST requests"</strong>:</li>
                    </ol>
                    <div className="bg-white/80 p-2 rounded border border-orange-200 font-mono text-[10px] flex justify-between items-center group">
                      <code>https://takjilku.netlify.app/webhook</code>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[8px] font-bold text-orange-500 uppercase">Salin alamat ini ke Wasender</div>
                    </div>
                  </AlertDescription>
                </Alert>

                <Button type="submit" disabled={isSavingParams} className="w-full md:w-auto px-12">
                  {isSavingParams ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Simpan Semua Parameter
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContentUI>

        <TabsContentUI value="mail" className="space-y-4 pt-4">
          <Alert className="bg-primary/5 border-primary/20">
            <Info className="h-4 w-4 text-primary" />
            <AlertTitle className="font-bold">Panduan Gmail SMTP</AlertTitle>
            <AlertDescription className="text-sm space-y-2">
              <p>Gunakan <strong>App Password</strong> 16 digit dari Akun Google Anda, bukan password email utama.</p>
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader><CardTitle>Konfigurasi SMTP</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleSaveEmailSettings} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>SMTP Host</Label><Input value={smtpSettings.host} onChange={(e) => setSmtpSettings({...smtpSettings, host: e.target.value})} /></div>
                  <div className="space-y-2"><Label>Port</Label><Input value={smtpSettings.port} onChange={(e) => setSmtpSettings({...smtpSettings, port: e.target.value})} /></div>
                  <div className="space-y-2"><Label>Username / Email</Label><Input value={smtpSettings.user} onChange={(e) => setSmtpSettings({...smtpSettings, user: e.target.value})} /></div>
                  <div className="space-y-2"><Label>App Password</Label><Input type="password" value={smtpSettings.pass} onChange={(e) => setSmtpSettings({...smtpSettings, pass: e.target.value})} /></div>
                  <div className="space-y-2 md:col-span-2"><Label>Email Pengirim (Name)</Label><Input value={smtpSettings.from} onChange={(e) => setSmtpSettings({...smtpSettings, from: e.target.value})} /></div>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={handleTestEmail} disabled={isTestingEmail}><Send className="mr-2 h-4 w-4" /> Test Email</Button>
                  <Button type="submit" disabled={isSavingEmail}><Save className="mr-2 h-4 w-4" /> Simpan</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContentUI>

        <TabsContentUI value="backup" className="space-y-4 pt-4">
          <Card>
            <CardHeader><CardTitle>Ekspor &amp; Impor Data</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="flex justify-between items-center p-4 border rounded-lg">
                <div className="space-y-1"><h4 className="font-bold">Pencadangan Penuh</h4><p className="text-sm text-muted-foreground">Unduh data ke JSON.</p></div>
                <Button onClick={handleBackup} disabled={isBackingUp}><Download className="mr-2 h-4 w-4" /> Unduh</Button>
              </div>
              <div className="flex justify-between items-center p-4 border rounded-lg">
                <div className="space-y-1"><h4 className="font-bold">Pemulihan Data</h4><p className="text-sm text-muted-foreground">Unggah file backup.</p></div>
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