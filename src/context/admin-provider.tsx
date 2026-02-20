'use client';

import React, { createContext, useState, ReactNode, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

interface AdminContextType {
  isAdminAuthenticated: boolean;
  login: (password: string) => boolean;
  logout: () => void;
}

export const AdminContext = createContext<AdminContextType | undefined>(undefined);

// Menggunakan variabel lingkungan jika ada, jika tidak gunakan default 'Anggrek#3'
const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'Anggrek#3';
const SESSION_STORAGE_KEY = 'admin_auth';

export function AdminProvider({ children }: { children: ReactNode }) {
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    try {
      const storedAuth = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (storedAuth === 'true') {
        setIsAdminAuthenticated(true);
      } else if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
        router.push('/admin/login');
      }
    } catch (error) {
      // sessionStorage is not available
    }
  }, [pathname, router]);

  const login = (password: string) => {
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem(SESSION_STORAGE_KEY, 'true');
      setIsAdminAuthenticated(true);
      // Redirect to Summary (Rekap Harian) as default landing page
      router.push('/admin/summary');
      return true;
    }
    return false;
  };

  const logout = () => {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    setIsAdminAuthenticated(false);
    router.push('/admin/login');
  };

  const value = { isAdminAuthenticated, login, logout };

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}
