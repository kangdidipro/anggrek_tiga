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
};

function groupProductsByCategory(products: Product[]): Record<string, Product[]> {
  return products.reduce((acc, product) => {
    const { category } = product;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(product);
    return acc;
  }, {} as Record<string, Product[]>);
}

export default function ProductList({ products, vendors }: ProductListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  
  const vendorLookup = useMemo(() => {
    const lookup: Record<string, string> = {};
    vendors.forEach(v => {
      lookup[v.code] = v.name;
    });
    return lookup;
  }, [vendors]);

  const filteredProducts = useMemo(() => 
    products.filter(product =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase())
    ), [products, searchTerm]);

  const productsByCategory = useMemo(() => groupProductsByCategory(filteredProducts), [filteredProducts]);
  // Add 'Semua' to the list of categories
  const categories = useMemo(() => ['Semua', ...Object.keys(productsByCategory)], [productsByCategory]);
  
  // Set default tab to 'Semua'
  const [activeTab, setActiveTab] = useState<string>('Semua');

  useEffect(() => {
    // If active tab is not available after filtering, set it to 'Semua'
    if (!categories.includes(activeTab)) {
      setActiveTab('Semua');
    }
  }, [categories, activeTab]);

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
        <Tabs 
          value={activeTab} 
          onValueChange={setActiveTab}
          defaultValue="Semua"
          className="w-full"
        >
          <TabsList className="flex flex-wrap h-auto bg-transparent gap-2 justify-center py-2 mb-8 border-none ring-0">
            {categories.map((category) => (
              <TabsTrigger 
                key={category} 
                value={category}
                className="rounded-full border border-primary/20 bg-card px-4 py-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary shadow-sm hover:bg-primary/5 transition-all text-xs md:text-sm h-auto"
              >
                {category}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Content for "Semua" tab */}
          <TabsContent value="Semua">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8 pt-4">
              {filteredProducts.map((product) => (
                <ProductCard 
                  key={product.id} 
                  product={product} 
                  vendorName={vendorLookup[product.vendor] || product.vendor} 
                />
              ))}
            </div>
          </TabsContent>

          {/* Content for other category tabs */}
          {Object.keys(productsByCategory).map((category) => (
            <TabsContent key={category} value={category}>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8 pt-4">
                {productsByCategory[category].map((product) => (
                  <ProductCard 
                    key={product.id} 
                    product={product} 
                    vendorName={vendorLookup[product.vendor] || product.vendor}
                  />
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <div className="text-center text-muted-foreground mt-8">
          <p>Tidak ada produk yang cocok dengan pencarian Anda.</p>
        </div>
      )}
    </>
  );
}
