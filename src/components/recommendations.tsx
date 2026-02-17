import { getRecommendedTakjil, type RecommendationOutput } from '@/ai/flows/ai-takjil-recommendation';
import { products } from '@/lib/products';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import ProductCard from './product-card';
import { Lightbulb } from 'lucide-react';
import type { Product } from '@/lib/types';

export default async function Recommendations() {
  let aiResponse: RecommendationOutput | null = null;
  
  try {
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'YOUR_API_KEY_HERE') {
      aiResponse = await getRecommendedTakjil({});
    }
  } catch (error) {
    console.error('Error fetching AI recommendations. Ensure your GEMINI_API_KEY is set correctly in .env file.', error);
    // Gracefully fail without breaking the page.
    return null;
  }
  
  if (!aiResponse || !aiResponse.recommendations || aiResponse.recommendations.length === 0) {
    return null;
  }

  const recommendedProducts = aiResponse.recommendations
    .map(name => products.find(p => p.name === name))
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
