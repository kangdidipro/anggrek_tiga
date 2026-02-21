
'use client';

import { useAdmin } from '@/hooks/use-admin';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Menu, Soup, Home, UtensilsCrossed, ListOrdered, LayoutDashboard, UserRound, Users, Settings, Database, LogOut, Tags } from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { href: '/', label: 'Halaman Depan', icon: Home },
  { href: '/admin/menu', label: 'Atur Menu', icon: UtensilsCrossed },
  { href: '/admin/categories', label: 'Master Kategori', icon: Tags },
  { href: '/admin/orders', label: 'List Order', icon: ListOrdered },
  { href: '/admin/summary', label: 'Rekap Harian', icon: LayoutDashboard },
  { href: '/admin/customers', label: 'Data Pelanggan', icon: UserRound },
  { href: '/admin/vendors', label: 'Master Mitra', icon: Users },
  { href: '/admin/settings', label: 'Pengaturan', icon: Settings },
  { href: '/admin/technical-data', label: 'Data Teknis', icon: Database },
];

export default function AdminMobileNav() {
  const { logout } = useAdmin();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden flex items-center justify-between p-4 border-b bg-card sticky top-0 z-50">
      <Link href="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
        <Soup className="h-6 w-6 text-primary" />
        <h2 className="text-lg font-bold font-headline">TakjilKu</h2>
      </Link>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon">
            <Menu className="h-6 w-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[280px] p-0 flex flex-col">
          <SheetHeader className="p-4 border-b">
            <SheetTitle className="flex items-center gap-2">
              <Soup className="h-6 w-6 text-primary" />
              TakjilKu Admin
            </SheetTitle>
          </SheetHeader>
          <nav className="flex-1 p-4 space-y-2 overflow-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-3 text-muted-foreground transition-all hover:text-primary',
                    isActive && 'bg-muted text-primary font-medium'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="p-4 border-t">
            <Button variant="outline" className="w-full justify-start gap-3" onClick={() => { logout(); setOpen(false); }}>
              <LogOut className="h-5 w-5" />
              Logout
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
