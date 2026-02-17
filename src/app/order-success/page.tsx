import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CircleCheck } from 'lucide-react';
import Link from 'next/link';

export default function OrderSuccessPage() {
  return (
    <div className="container flex items-center justify-center py-24 min-h-[calc(100vh-10rem)]">
      <Card className="w-full max-w-md text-center shadow-lg">
        <CardHeader className="items-center">
            <CircleCheck className="h-16 w-16 text-green-500 mb-4" />
          <CardTitle className="text-3xl font-headline">Pesanan Berhasil!</CardTitle>
          <CardDescription className="text-lg">
            Terima kasih telah memesan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-6">
            Pesanan Anda telah kami terima dan akan segera kami proses. Mohon tunggu konfirmasi selanjutnya dari tim kami.
          </p>
          <Button asChild className="w-full">
            <Link href="/">Kembali ke Menu</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
