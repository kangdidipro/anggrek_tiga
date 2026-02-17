'use client';

import { useAdmin } from '@/hooks/use-admin';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import AdminSidebar from '@/components/admin/sidebar';
import { Loader2 } from 'lucide-react';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { isAdminAuthenticated } = useAdmin();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // A slight delay to allow auth state to be read from session storage
    const timer = setTimeout(() => {
        if (!isAdminAuthenticated && pathname !== '/admin/login') {
            router.push('/admin/login');
        }
    }, 100);
    return () => clearTimeout(timer);
  }, [isAdminAuthenticated, pathname, router]);

  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  if (!isAdminAuthenticated) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <main className="flex-1 p-4 md:p-8 bg-muted/40 overflow-auto">
        {children}
      </main>
    </div>
  );
}
