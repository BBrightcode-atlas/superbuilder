import { z } from "zod";

export const createFeatureRequestSchema = z.object({
  title: z.string().min(1).max(200),
  rawPrompt: z.string().min(1),
  summary: z.string().optional(),
  rulesetReference: z.string().optional(),
});

export const appendFeatureRequestMessageSchema = z.object({
  featureRequestId: z.string().uuid(),
  role: z.enum(["system", "assistant", "user"]),
  content: z.string().min(1),
  kind: z.enum(["conversation", "event", "note"]).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type CreateFeatureRequestDto = z.infer<typeof createFeatureRequestSchema>;
export type AppendFeatureRequestMessageDto = z.infer<
  typeof appendFeatureRequestMessageSchema
>;
