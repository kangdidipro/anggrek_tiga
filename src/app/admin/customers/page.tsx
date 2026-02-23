'use client';

import { useState, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Search, UserRound, Phone, MapPin, Mail, ArrowUpDown, ArrowUp, ArrowDown, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface Customer {
  id: string;
  name: string;
  email: string;
  phoneNumber: string;
  deliveryAddress: string;
  lastOrderAt?: string;
}

type SortConfig = {
  key: keyof Customer | 'contact';
  direction: 'asc' | 'desc';
};

export default function AdminCustomersPage() {
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [phoneFilter, setPhoneFilter] = useState('');
  const [addressFilter, setAddressFilter] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'lastOrderAt', direction: 'desc' });

  const customersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'customers');
  }, [firestore]);

  const { data: customers, isLoading } = useCollection<Customer>(customersQuery);

  const handleSort = (key: keyof Customer | 'contact') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: keyof Customer | 'contact') => {
    if (sortConfig.key !== key) return <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-4 w-4 text-primary" /> : <ArrowDown className="ml-2 h-4 w-4 text-primary" />;
  };

  const filteredCustomers = useMemo(() => {
    if (!customers) return [];
    
    let result = customers.filter(c => {
      const matchesGlobal = searchTerm === '' || 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phoneNumber.includes(searchTerm) ||
        c.deliveryAddress.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesName = nameFilter === '' || c.name.toLowerCase().includes(nameFilter.toLowerCase());
      const matchesPhone = phoneFilter === '' || c.phoneNumber.includes(phoneFilter) || (c.email && c.email.toLowerCase().includes(phoneFilter.toLowerCase()));
      const matchesAddress = addressFilter === '' || c.deliveryAddress.toLowerCase().includes(addressFilter.toLowerCase());

      return matchesGlobal && matchesName && matchesPhone && matchesAddress;
    });

    if (sortConfig.key) {
      result.sort((a, b) => {
        let valA: any = '';
        let valB: any = '';

        if (sortConfig.key === 'contact') {
          valA = a.phoneNumber || '';
          valB = b.phoneNumber || '';
        } else if (sortConfig.key === 'lastOrderAt') {
          valA = a.lastOrderAt ? new Date(a.lastOrderAt).getTime() : 0;
          valB = b.lastOrderAt ? new Date(b.lastOrderAt).getTime() : 0;
        } else {
          valA = (a[sortConfig.key as keyof Customer] || '').toString().toLowerCase();
          valB = (b[sortConfig.key as keyof Customer] || '').toString().toLowerCase();
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [customers, searchTerm, nameFilter, phoneFilter, addressFilter, sortConfig]);

  const resetFilters = () => {
    setSearchTerm('');
    setNameFilter('');
    setPhoneFilter('');
    setAddressFilter('');
    setSortConfig({ key: 'lastOrderAt', direction: 'desc' });
  };

  if (isLoading) {
    return <div className="flex h-full items-center justify-center p-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">Data Pelanggan</h1>
          <p className="text-muted-foreground">Daftar warga yang telah melakukan pemesanan Takjil.</p>
        </div>
        <Button variant="outline" size="sm" onClick={resetFilters}>
          <X className="mr-2 h-4 w-4" /> Reset Filter
        </Button>
      </div>

      <Card className="p-4 border-primary/10 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="space-y-2">
            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Cari Nama</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Nama..."
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
                className="pl-10 h-9 text-sm"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Cari Kontak</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="No HP / Email..."
                value={phoneFilter}
                onChange={(e) => setPhoneFilter(e.target.value)}
                className="pl-10 h-9 text-sm"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Cari Alamat</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Alamat..."
                value={addressFilter}
                onChange={(e) => setAddressFilter(e.target.value)}
                className="pl-10 h-9 text-sm"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Pencarian Global</Label>
            <Input
              placeholder="Cari apa saja..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
        </div>
      </Card>

      <div className="flex items-center gap-2 text-sm text-muted-foreground px-1">
        <span>Total Terfilter:</span>
        <span className="font-bold text-foreground bg-primary/10 px-2 py-0.5 rounded">{filteredCustomers.length}</span>
        <span className="text-[10px] uppercase tracking-tighter">dari {customers?.length || 0} Pelanggan</span>
      </div>

      <Card className="border-primary/5">
        <CardContent className="p-0 overflow-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort('name')}>
                  <div className="flex items-center text-[10px] font-bold uppercase tracking-widest">
                    Nama Pelanggan {getSortIcon('name')}
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort('contact')}>
                  <div className="flex items-center text-[10px] font-bold uppercase tracking-widest">
                    Kontak {getSortIcon('contact')}
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort('deliveryAddress')}>
                  <div className="flex items-center text-[10px] font-bold uppercase tracking-widest">
                    Alamat Terakhir {getSortIcon('deliveryAddress')}
                  </div>
                </TableHead>
                <TableHead className="text-right cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort('lastOrderAt')}>
                  <div className="flex items-center justify-end text-[10px] font-bold uppercase tracking-widest">
                    Order Terakhir {getSortIcon('lastOrderAt')}
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-20 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Search className="h-8 w-8 opacity-20" />
                      <p>Tidak ada data pelanggan yang cocok.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredCustomers.map((customer) => (
                  <TableRow key={customer.id} className="hover:bg-primary/5 transition-colors">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                          <UserRound className="h-4 w-4 text-primary" />
                        </div>
                        <span className="uppercase font-bold text-xs tracking-tight">{customer.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-2 font-mono font-bold text-blue-600">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          {customer.phoneNumber}
                        </div>
                        {customer.email && (
                          <div className="flex items-center gap-2 text-muted-foreground italic">
                            <Mail className="h-3 w-3" />
                            {customer.email}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[300px]">
                      <div className="flex items-start gap-2 text-[11px] leading-relaxed">
                        <MapPin className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                        <span className="line-clamp-2 italic text-muted-foreground">{customer.deliveryAddress}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-xs font-bold text-primary">
                      {customer.lastOrderAt ? format(new Date(customer.lastOrderAt), 'd MMM yyyy', { locale: id }) : '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}