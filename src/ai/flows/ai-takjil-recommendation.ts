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

// Mock data for popular items by hour. In a real application, this would come from a database
// or an analytics service tracking frequently ordered items.
const popularItemsByHour: { [key: string]: string[] } = {
  '0-5': ['Nasi Bakar Ayam', 'Nasi Bakar Cakalang', 'Frozen Vacum Pempek kecil Campur isi 15'], // Early morning
  '6-10': ['Kolak Pisang, Ubi, Kolang-kaling', 'Bubur Sumsum', 'Lontong Isi Oncom', 'Kue Lumpur Labu Kuning'], // Morning
  '11-14': ['Rendang Padang', 'Mie Aceh Goreng', 'Pempek Kapal Selem Besar', 'Nasi Kebuli Kari Ayam'], // Lunch
  '15-18': ['Bakso Urat', 'Soto Mie', 'Kroket (isi Udang, Macroni, Tahu, Telor)', 'Es Buah', 'Klepon Gula Merah'], // Afternoon/Pre-breaking fast
  '19-23': ['Crispy Chicken Steak', 'Dimsum', 'Spaghetti Brulee', 'Kebab Mini', 'Don Alejandro Pizza'], // Evening/After breaking fast
};

/**
 * Helper function to simulate fetching popular items based on the hour.
 * In a production system, this would interact with a real data source.
 */
function getPopularItemsForHour(hour: number): string[] {
  if (hour >= 0 && hour <= 5) return popularItemsByHour['0-5'];
  if (hour >= 6 && hour <= 10) return popularItemsByHour['6-10'];
  if (hour >= 11 && hour <= 14) return popularItemsByHour['11-14'];
  if (hour >= 15 && hour <= 18) return popularItemsByHour['15-18'];
  if (hour >= 19 && hour <= 23) return popularItemsByHour['19-23'];
  return []; // This case should ideally not be reached with a valid hour (0-23)
}

// Input schema for the overall recommendation flow. It's an empty object
// as the current time is determined internally by the flow.
const RecommendationInputSchema = z.object({});
export type RecommendationInput = z.infer<typeof RecommendationInputSchema>;

// Output schema for the AI-powered Takjil recommendations.
// It includes a list of recommended items and an optional message from the AI.
const RecommendationOutputSchema = z.object({
  recommendations: z.array(z.string()).describe('A list of recommended Takjil item names.'),
  message: z.string().optional().describe('An optional message accompanying the recommendations, in Bahasa Indonesia.'),
});
export type RecommendationOutput = z.infer<typeof RecommendationOutputSchema>;

/**
 * Genkit tool to retrieve popular Takjil items for a specific hour.
 * The Large Language Model (LLM) decides when and if to call this tool
 * based on the prompt's instructions and the conversation context.
 */
const getPopularTakjilItemsTool = ai.defineTool(
  {
    name: 'getPopularTakjilItems',
    description: 'Returns a list of popular Takjil items for a given hour of the day.',
    inputSchema: z.object({
      hour: z.number().describe('The current hour of the day (0-23).'),
    }),
    outputSchema: z.array(z.string()).describe('A list of popular Takjil item names.'),
  },
  async (input) => {
    // The implementation calls the mock helper function.
    // In a real application, this would query a database for trending items.
    return getPopularItemsForHour(input.hour);
  }
);

/**
 * Genkit prompt for generating Takjil recommendations.
 * This prompt instructs the LLM to use the `getPopularTakjilItems` tool
 * to get the relevant data before formulating its response.
 */
const recommendTakjilPrompt = ai.definePrompt({
  name: 'recommendTakjilPrompt',
  input: { schema: z.object({ currentHour: z.number().describe('The current hour in 24-hour format.') }) },
  output: { schema: RecommendationOutputSchema },
  tools: [getPopularTakjilItemsTool],
  system:
    'Anda adalah asisten yang ramah yang merekomendasikan item Takjil populer. Tujuan Anda adalah memberikan daftar item populer berdasarkan jam saat ini. Gunakan alat `getPopularTakjilItems` untuk mendapatkan item populer untuk jam yang diberikan, lalu sajikan dengan baik. Jika tidak ada item yang ditemukan untuk jam yang diberikan, nyatakan demikian. Tanggapi dalam Bahasa Indonesia.',
  prompt: 'Jam saat ini adalah {{{currentHour}}} (format 24 jam). Apa saja Takjil populer saat ini?',
});

/**
 * Genkit flow to get AI-powered Takjil recommendations based on the current time.
 * This flow determines the current hour and passes it to the recommendation prompt.
 */
const recommendTakjilFlow = ai.defineFlow(
  {
    name: 'recommendTakjilFlow',
    inputSchema: RecommendationInputSchema,
    outputSchema: RecommendationOutputSchema,
  },
  async (input) => {
    // Get the current hour at the time the flow is executed.
    const currentHour = new Date().getHours();

    // Call the prompt with the current hour. The LLM will then decide to use the tool.
    const { output } = await recommendTakjilPrompt({ currentHour });
    return output!;
  }
);

/**
 * Wrapper function to call the `recommendTakjilFlow`.
 * This function serves as the public API for requesting Takjil recommendations.
 * @param input - The input for the recommendation flow (currently an empty object as time is internal).
 * @returns A promise that resolves to the recommended Takjil items and an optional message.
 */
export async function getRecommendedTakjil(
  input: RecommendationInput
): Promise<RecommendationOutput> {
  if (!process.env.GEMINI_API_KEY) {
    console.warn("GEMINI_API_KEY is not set in .env. Skipping AI recommendations.");
    // Return an empty response to prevent crashing the app and hide the component.
    return { recommendations: [] };
  }
  try {
    return await recommendTakjilFlow(input);
  } catch (error) {
    console.error("An error occurred while fetching AI recommendations:", error);
    // Also return an empty response on other errors during the flow execution.
    return { recommendations: [] };
  }
}
