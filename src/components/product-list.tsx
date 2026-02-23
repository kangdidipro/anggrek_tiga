'use client';

import { useState, useMemo, useEffect } from 'react';
import type { Product, Vendor } from '@/lib/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ProductCard from '@/components/product-card';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

type ProductListProps = {
  products: Product[];
  vendors: Vendor[];
  categories: any[];
  displayMode: string;
  displaySettings?: {
    showActiveMenu?: boolean;
    showInactiveMenu?: boolean;
    showActiveVendor?: boolean;
    showInactiveVendor?: boolean;
  };
};

export default function ProductList({ products, vendors, categories, displayMode, displaySettings }: ProductListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<string>('Semua');
  
  const vendorLookup = useMemo(() => {
    const lookup: Record<string, { name: string, isActive: boolean }> = {};
    vendors.forEach(v => {
      lookup[v.code] = { 
        name: v.name, 
        isActive: v.isActive !== false 
      };
    });
    return lookup;
  }, [vendors]);

  const categoryLookup = useMemo(() => {
    const lookup: Record<string, any> = {};
    categories.forEach(c => {
      lookup[c.name.trim().toLowerCase()] = c;
    });
    return lookup;
  }, [categories]);

  const filteredProducts = useMemo(() => {
    // Visibility settings from Admin
    const showActiveMenu = displaySettings?.showActiveMenu ?? true;
    const showInactiveMenu = displaySettings?.showInactiveMenu ?? false;
    const showActiveVendor = displaySettings?.showActiveVendor ?? true;
    const showInactiveVendor = displaySettings?.showInactiveVendor ?? false;

    return products.filter(product => {
      // 1. Search filter
      if (searchTerm && !product.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }

      const vendor = vendorLookup[product.vendor];
      const isVendorActive = vendor?.isActive ?? true;
      const isProductActive = product.isActive !== false;

      // 2. Filter by Product Activity
      if (isProductActive && !showActiveMenu) return false;
      if (!isProductActive && !showInactiveMenu) return false;

      // 3. Filter by Vendor Activity
      if (isVendorActive && !showActiveVendor) return false;
      if (!isVendorActive && !showInactiveVendor) return false;

      return true;
    });
  }, [products, searchTerm, vendorLookup, displaySettings]);

  const productsGrouped = useMemo(() => {
    const grouped: Record<string, Product[]> = {};
    
    filteredProducts.forEach(product => {
      let key = 'Semua';
      
      if (displayMode === 'group') {
        const catInfo = categoryLookup[product.category.trim().toLowerCase()];
        key = catInfo?.group || 'Snack/Camilan'; // Default group if not set
      } else if (displayMode === 'category') {
        key = product.category;
      } else {
        key = 'Semua';
      }

      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(product);
    });

    return grouped;
  }, [filteredProducts, displayMode, categoryLookup]);

  const tabs = useMemo(() => {
    if (displayMode === 'none') return ['Semua'];
    return ['Semua', ...Object.keys(productsGrouped).filter(k => k !== 'Semua')].sort((a, b) => {
      if (a === 'Semua') return -1;
      if (b === 'Semua') return 1;
      return a.localeCompare(b);
    });
  }, [productsGrouped, displayMode]);

  useEffect(() => {
    if (!tabs.includes(activeTab)) {
      setActiveTab('Semua');
    }
  }, [tabs, activeTab]);

  return (
    <>
      <div className="relative mb-8 max-w-lg mx-auto">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Cari produk..."
          className="w-full pl-10"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {filteredProducts.length > 0 ? (
        displayMode === 'none' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8 pt-4">
            {filteredProducts.map((product) => (
              <ProductCard 
                key={product.id} 
                product={product} 
                vendorName={vendorLookup[product.vendor]?.name || product.vendor} 
                isVendorActive={vendorLookup[product.vendor]?.isActive ?? true}
              />
            ))}
          </div>
        ) : (
          <Tabs 
            value={activeTab} 
            onValueChange={setActiveTab}
            defaultValue="Semua"
            className="w-full"
          >
            <TabsList className="flex flex-wrap h-auto bg-transparent gap-2 justify-center py-2 mb-8 border-none ring-0">
              {tabs.map((tab) => {
                const count = tab === 'Semua' 
                  ? filteredProducts.length 
                  : (productsGrouped[tab]?.length || 0);

                return (
                  <TabsTrigger 
                    key={tab} 
                    value={tab}
                    className="rounded-full border border-primary/20 bg-card px-4 py-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary shadow-sm hover:bg-primary/5 transition-all text-xs md:text-sm h-auto"
                  >
                    {tab} 
                    <span className="ml-1 opacity-70 font-mono text-[10px]">({count})</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <TabsContent value="Semua">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8 pt-4">
                {filteredProducts.map((product) => (
                  <ProductCard 
                    key={product.id} 
                    product={product} 
                    vendorName={vendorLookup[product.vendor]?.name || product.vendor} 
                    isVendorActive={vendorLookup[product.vendor]?.isActive ?? true}
                  />
                ))}
              </div>
            </TabsContent>

            {Object.keys(productsGrouped).map((tab) => tab !== 'Semua' && (
              <TabsContent key={tab} value={tab}>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8 pt-4">
                  {productsGrouped[tab].map((product) => (
                    <ProductCard 
                      key={product.id} 
                      product={product} 
                      vendorName={vendorLookup[product.vendor]?.name || product.vendor}
                      isVendorActive={vendorLookup[product.vendor]?.isActive ?? true}
                    />
                  ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        )
      ) : (
        <div className="text-center text-muted-foreground mt-8">
          <p>Tidak ada produk yang cocok dengan pengaturan tampilan atau pencarian Anda.</p>
        </div>
      )}
    </>
  );
}
