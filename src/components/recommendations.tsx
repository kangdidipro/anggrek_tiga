'use client';

import { useState, useEffect } from 'react';
import { getRecommendedTakjil, type RecommendationOutput } from '@/ai/flows/ai-takjil-recommendation';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import ProductCard from './product-card';
import { Lightbulb } from 'lucide-react';
import type { Product } from '@/lib/types';
import { Skeleton } from './ui/skeleton';

interface RecommendationsProps {
  products: Product[];
}

export default function Recommendations({ products }: RecommendationsProps) {
  const [aiResponse, setAiResponse] = useState<RecommendationOutput | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchRecommendations = async () => {
      setIsLoading(true);
      try {
        // Attempt to fetch recommendations with a timeout safety
        const response = await getRecommendedTakjil({});
        if (isMounted) {
          setAiResponse(response);
        }
      } catch (error) {
        // Catch network errors (like "Failed to fetch") silently to avoid UI crash
        console.warn('Network error or timeout while fetching recommendations.');
        if (isMounted) {
          setAiResponse({ recommendations: [] });
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchRecommendations();

    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading) {
    return (
        <section className="container">
            <div className="flex flex-col items-center gap-4 mb-8">
                <Skeleton className="h-10 w-3/4 max-w-lg" />
                <Skeleton className="h-6 w-1/2 max-w-md" />
            </div>
            <div className="relative">
                <div className="flex -ml-1">
                    <div className="w-full sm:basis-1/2 md:basis-1/3 lg:basis-1/4 p-1">
                        <Skeleton className="h-[250px] w-full" />
                    </div>
                </div>
            </div>
      </section>
    );
  }
  
  if (!aiResponse || !aiResponse.recommendations || aiResponse.recommendations.length === 0) {
    return null;
  }

  const recommendedProducts = aiResponse.recommendations
    .map(name => products.find(p => p.name.toLowerCase() === name.toLowerCase()))
    .filter((p): p is Product => Boolean(p));

  if (recommendedProducts.length === 0) {
    return null;
  }

  return (
    <section className="container">
      <div className="flex flex-col items-center gap-4 mb-8">
        <div className="flex items-center gap-2 text-2xl font-bold tracking-tighter sm:text-3xl md:text-4xl font-headline text-accent-foreground">
            <Lightbulb className="h-8 w-8 text-accent" />
            <span>Rekomendasi Terlaris Saat Ini</span>
        </div>
        {aiResponse.message && <p className="max-w-[900px] text-muted-foreground md:text-lg/relaxed text-center">{aiResponse.message}</p>}
      </div>

      <Carousel
        opts={{
          align: "start",
          loop: true,
        }}
        className="w-full"
      >
        <CarouselContent>
          {recommendedProducts.map((product, index) => (
            product && (
              <CarouselItem key={index} className="sm:basis-1/2 md:basis-1/3 lg:basis-1/4">
                <div className="p-1">
                  <ProductCard product={product} />
                </div>
              </CarouselItem>
            )
          ))}
        </CarouselContent>
        <CarouselPrevious className="hidden md:flex" />
        <CarouselNext className="hidden md:flex" />
      </Carousel>
    </section>
  );
}
