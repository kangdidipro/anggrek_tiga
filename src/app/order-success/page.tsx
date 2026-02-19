'use client';

import { Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CircleCheck, Mail, Search } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function OrderSuccessContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email');
  const orderId = searchParams.get('orderId');

  return (
    <Card className="w-full max-w-md text-center shadow-lg border-primary/20">
      <CardHeader className="items-center">
        <CircleCheck className="h-16 w-16 text-green-500 mb-4" />
        <CardTitle className="text-3xl font-headline text-primary">Pesanan Berhasil!</CardTitle>
        <CardDescription className="text-lg">
          Terima kasih telah memesan.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <p className="text-muted-foreground">
            Pesanan Anda telah kami terima dan akan segera kami proses. Mohon tunggu konfirmasi selanjutnya dari tim kami.
          </p>
          {orderId && (
            <p className="text-sm font-mono bg-muted py-1 rounded">
              ID Pesanan: #{orderId.substring(0, 7)}
            </p>
          )}
        </div>

        {email && (
          <div className="flex items-start gap-3 p-4 bg-primary/5 rounded-lg text-left border border-primary/10">
            <Mail className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-semibold">Struk Terkirim</p>
              <p className="text-xs text-muted-foreground">
                Rincian pesanan dan struk PDF telah dikirim ke: <br />
                <span className="font-medium text-foreground">{email}</span>
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <Button asChild className="w-full" size="lg">
            <Link href="/orders" className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              Lacak Pesanan Saya
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/">Kembali ke Menu Utama</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function OrderSuccessPage() {
  return (
    <div className="container flex items-center justify-center py-24 min-h-[calc(100vh-10rem)] px-4">
      <Suspense fallback={<div>Loading...</div>}>
        <OrderSuccessContent />
      </Suspense>
    </div>
  );
}