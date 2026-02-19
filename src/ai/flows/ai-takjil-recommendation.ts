'use server';
/**
 * @fileOverview A Genkit flow for recommending popular Takjil items based on the current time of day.
 *
 * - getRecommendedTakjil - A function that fetches AI-powered Takjil recommendations.
 * - RecommendationInput - The input type for the getRecommendedTakjil function (currently an empty object).
 * - RecommendationOutput - The return type for the getRecommendedTakjil function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Mock data for popular items by hour.
const popularItemsByHour: { [key: string]: string[] } = {
  '0-5': ['Nasi Bakar Ayam', 'Nasi Bakar Cakalang', 'Frozen Vacum Pempek kecil Campur isi 15'],
  '6-10': ['Kolak Pisang, Ubi, Kolang-kaling', 'Bubur Sumsum', 'Lontong Isi Oncom', 'Kue Lumpur Labu Kuning'],
  '11-14': ['Rendang Padang', 'Mie Aceh Goreng', 'Pempek Kapal Selem Besar', 'Nasi Kebuli Kari Ayam'],
  '15-18': ['Bakso Urat', 'Soto Mie', 'Kroket (isi Udang, Macroni, Tahu, Telor)', 'Es Buah', 'Klepon Gula Merah'],
  '19-23': ['Crispy Chicken Steak', 'Dimsum', 'Spaghetti Brulee', 'Kebab Mini', 'Don Alejandro Pizza'],
};

function getPopularItemsForHour(hour: number): string[] {
  if (hour >= 0 && hour <= 5) return popularItemsByHour['0-5'];
  if (hour >= 6 && hour <= 10) return popularItemsByHour['6-10'];
  if (hour >= 11 && hour <= 14) return popularItemsByHour['11-14'];
  if (hour >= 15 && hour <= 18) return popularItemsByHour['15-18'];
  if (hour >= 19 && hour <= 23) return popularItemsByHour['19-23'];
  return [];
}

const RecommendationInputSchema = z.object({});
export type RecommendationInput = z.infer<typeof RecommendationInputSchema>;

const RecommendationOutputSchema = z.object({
  recommendations: z.array(z.string()).describe('A list of recommended Takjil item names.'),
  message: z.string().optional().describe('An optional message accompanying the recommendations, in Bahasa Indonesia.'),
});
export type RecommendationOutput = z.infer<typeof RecommendationOutputSchema>;

/**
 * Genkit prompt for generating Takjil recommendations.
 * Optimization: Now accepts popularItems as input directly to avoid slow tool calls.
 */
const recommendTakjilPrompt = ai.definePrompt({
  name: 'recommendTakjilPrompt',
  input: { 
    schema: z.object({ 
      currentHour: z.number().describe('The current hour in 24-hour format.'),
      popularItems: z.array(z.string()).describe('A list of trending items for this time.')
    }) 
  },
  output: { schema: RecommendationOutputSchema },
  system:
    'Anda adalah asisten ramah yang merekomendasikan Takjil. Berikan rekomendasi berdasarkan daftar item populer yang diberikan. Berikan pesan singkat yang menarik dalam Bahasa Indonesia.',
  prompt: `Jam saat ini adalah {{{currentHour}}}. Item populer saat ini adalah: {{#each popularItems}}{{{this}}}, {{/each}}. Apa rekomendasi Anda?`,
});

const recommendTakjilFlow = ai.defineFlow(
  {
    name: 'recommendTakjilFlow',
    inputSchema: RecommendationInputSchema,
    outputSchema: RecommendationOutputSchema,
  },
  async (input) => {
    const currentHour = new Date().getHours();
    const popularItems = getPopularItemsForHour(currentHour);

    const { output } = await recommendTakjilPrompt({ currentHour, popularItems });
    return output!;
  }
);

export async function getRecommendedTakjil(
  input: RecommendationInput
): Promise<RecommendationOutput> {
  if (!process.env.GEMINI_API_KEY) {
    return { recommendations: [] };
  }
  try {
    // Adding a timeout or ensuring rapid response
    return await recommendTakjilFlow(input);
  } catch (error) {
    console.error("AI Recommendation error:", error);
    return { recommendations: [] };
  }
}
