import { z } from "zod";

const clientEnvSchema = z.object({
  VITE_API_URL: z.string().url().optional(),
  VITE_AUTH_PROVIDERS: z.string().optional(),
});

export const env = clientEnvSchema.parse({
  VITE_API_URL: import.meta.env.VITE_API_URL,
  VITE_AUTH_PROVIDERS: import.meta.env.VITE_AUTH_PROVIDERS,
});
