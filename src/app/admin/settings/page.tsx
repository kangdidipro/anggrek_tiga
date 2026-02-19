'use client';

import { useState } from 'react';
import { useFirestore, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, getDocs, writeBatch, query, collectionGroup } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Mail, Database, Trash2, Save, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
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

export default function AdminSettingsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSavingEmail, setIsSavingEmail] = useState(false);

  // Email Server Settings State (Mock)
  const [smtpSettings, setSmtpSettings] = useState({
    host: 'smtp.gmail.com',
    port: '587',
    user: '',
    pass: '',
    from: 'takjilku@example.com',
  });

  const handleSaveEmailSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingEmail(true);
    // Simulasi penyimpanan ke Firestore atau Env
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsSavingEmail(false);
    toast({
      title: "Konfigurasi Disimpan",
      description: "Pengaturan Mail Server telah berhasil diperbarui (Simulasi).",
    });
  };

  const clearCollection = async (collectionPath: string, label: string) => {
    if (!firestore) return;
    setIsDeleting(true);
    try {
      let q;
      if (collectionPath.includes('/')) {
         q = query(collectionGroup(firestore, collectionPath.split('/').pop()!));
      } else {
         q = query(collection(firestore, collectionPath));
      }
      
      const snapshot = await getDocs(q);
      const batch = writeBatch(firestore);
      
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      toast({
        title: "Berhasil",
        description: `Seluruh data pada tabel ${label} telah dihapus.`,
      });
    } catch (error: any) {
      console.error(`Error clearing ${label}:`, error);
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: collectionPath,
        operation: 'delete',
      }));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-headline">Pengaturan Sistem</h1>
        <p className="text-muted-foreground">Kelola konfigurasi pengiriman email dan pemeliharaan basis data.</p>
      </div>

      <Tabs defaultValue="mail" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="mail" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Mail Server
          </TabsTrigger>
          <TabsTrigger value="data" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Manajemen Data
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mail" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Konfigurasi SMTP</CardTitle>
              <CardDescription>
                Atur server SMTP untuk mengirimkan struk PDF dan laporan rekap harian secara otomatis.
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
                      placeholder="••••••••••••" 
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="smtp-from">Email Pengirim (From)</Label>
                    <Input 
                      id="smtp-from" 
                      value={smtpSettings.from} 
                      onChange={(e) => setSmtpSettings({...smtpSettings, from: e.target.value})}
                      placeholder="TakjilKu <no-reply@takjilku.com>" 
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={isSavingEmail}>
                    {isSavingEmail ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Simpan Konfigurasi
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data" className="space-y-4 pt-4">
          <Card className="border-destructive/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Zona Berbahaya
              </CardTitle>
              <CardDescription>
                Hapus data secara permanen dari basis data. Tindakan ini tidak dapat dibatalkan.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 border rounded-lg bg-destructive/5 gap-4">
                <div>
                  <h4 className="font-bold">Kosongkan Semua Pesanan</h4>
                  <p className="text-sm text-muted-foreground">Menghapus seluruh riwayat pesanan (Orders & Order Items) dari semua pelanggan.</p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" disabled={isDeleting}>
                      {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                      Hapus Pesanan
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Hapus Seluruh Pesanan?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Ini akan menghapus semua data di tabel Orders dan OrderItems. Tindakan ini permanen.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Batal</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={() => clearCollection('orders', 'Pesanan')}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Ya, Hapus Semua
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 border rounded-lg gap-4">
                <div>
                  <h4 className="font-bold">Hapus Seluruh Menu</h4>
                  <p className="text-sm text-muted-foreground">Menghapus semua item menu takjil yang saat ini terdaftar.</p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10" disabled={isDeleting}>
                      {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                      Hapus Menu
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Hapus Seluruh Menu?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Daftar menu takjil akan dikosongkan. Anda harus mengunggah ulang menu atau menggunakan menu default.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Batal</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={() => clearCollection('menuItems', 'Menu')}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Ya, Hapus Semua
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 border rounded-lg gap-4">
                <div>
                  <h4 className="font-bold">Hapus Seluruh Mitra</h4>
                  <p className="text-sm text-muted-foreground">Menghapus semua data mitra (Master Mitra) dari database.</p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10" disabled={isDeleting}>
                      {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                      Hapus Mitra
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Hapus Seluruh Mitra?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Seluruh data mitra akan dihapus. Ini dapat menyebabkan data pesanan yang sudah ada kehilangan referensi mitra.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Batal</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={() => clearCollection('vendors', 'Mitra')}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Ya, Hapus Semua
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
