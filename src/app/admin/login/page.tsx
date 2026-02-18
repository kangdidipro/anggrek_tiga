'use client';

import { useState } from 'react';
import { useAdmin } from '@/hooks/use-admin';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Lock, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function AdminLoginPage() {
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAdmin();
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const success = login(password);
    if (!success) {
      toast({
        variant: 'destructive',
        title: 'Login Gagal',
        description: 'Password yang Anda masukkan salah.',
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl flex items-center justify-center gap-2">
            <Lock className="h-6 w-6" />
            Admin Login
          </CardTitle>
          <CardDescription>
            Masukkan password untuk mengakses panel admin.
            <br />
            <span className="mt-2 block font-medium text-destructive">
              panel Admin adalah halaman untuk pengelola TakjilKU saja, bukan untuk pemesan
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Loading...' : 'Login'}
            </Button>
          </form>
          <div className="text-center pt-2">
            <Button variant="link" asChild className="text-muted-foreground hover:text-primary p-0 h-auto font-normal">
              <Link href="/" className="flex items-center gap-2 justify-center">
                <ArrowLeft className="h-4 w-4" />
                Kembali ke Halaman Utama
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
