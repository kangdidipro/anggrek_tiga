'use client';

import { useContext } from 'react';
import { AdminContext } from '@/context/admin-provider';

export function useAdmin() {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
}
