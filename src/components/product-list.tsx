'use client';

import { useState, useMemo, useEffect } from 'react';
import type { Product } from '@/lib/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ProductCard from '@/components/product-card';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

type ProductListProps = {
  products: Product[];
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

export default function ProductList({ products }: ProductListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  
  const filteredProducts = useMemo(() => 
    products.filter(product =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase())
    ), [products, searchTerm]);

  const productsByCategory = useMemo(() => groupProductsByCategory(filteredProducts), [filteredProducts]);
  const categories = useMemo(() => Object.keys(productsByCategory), [productsByCategory]);
  
  const [activeTab, setActiveTab] = useState<string | undefined>(categories[0]);

  useEffect(() => {
    if (categories.length > 0 && !categories.includes(activeTab || '')) {
      setActiveTab(categories[0]);
    } else if (categories.length === 0) {
      setActiveTab(undefined);
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
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 lg:flex lg:flex-wrap lg:h-auto justify-center">
            {categories.map((category) => (
              <TabsTrigger key={category} value={category}>{category}</TabsTrigger>
            ))}
          </TabsList>
          {categories.map((category) => (
            <TabsContent key={category} value={category}>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8 pt-8">
                {productsByCategory[category].map((product) => (
                  <ProductCard key={product.id} product={product} />
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
