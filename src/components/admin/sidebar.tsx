'use client';

import { useAdmin } from '@/hooks/use-admin';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ListOrdered, LayoutDashboard, LogOut, Soup } from 'lucide-react';

const navItems = [
  { href: '/admin/orders', label: 'List Order', icon: ListOrdered },
  { href: '/admin/summary', label: 'Rekap Harian', icon: LayoutDashboard },
];

export default function AdminSidebar() {
  const { logout } = useAdmin();
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-64 border-r bg-card text-card-foreground">
      <div className="p-4 border-b">
        <Link href="/" className="flex items-center gap-2">
          <Soup className="h-6 w-6 text-primary" />
          <h2 className="text-lg font-bold font-headline">TakjilKu Admin</h2>
        </Link>
      </div>
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary',
                pathname === item.href && 'bg-muted text-primary'
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 mt-auto border-t">
        <Button variant="outline" className="w-full" onClick={logout}>
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </aside>
  );
}
