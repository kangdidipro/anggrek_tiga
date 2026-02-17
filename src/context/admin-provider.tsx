'use client';

import React, { createContext, useState, ReactNode, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

interface AdminContextType {
  isAdminAuthenticated: boolean;
  login: (password: string) => boolean;
  logout: () => void;
}

export const AdminContext = createContext<AdminContextType | undefined>(undefined);

const ADMIN_PASSWORD = 'Angrek3';
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
      router.push('/admin/orders');
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
