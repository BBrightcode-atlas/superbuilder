import type { AppRouter } from "@superset/trpc";
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { z } from "zod";
import { env } from "main/env.main";
import { loadToken } from "../auth/utils/auth-functions";
import { publicProcedure, router } from "../..";

async function getAuthHeaders(): Promise<Record<string, string>> {
	const { token } = await loadToken();
	if (!token) {
		return {};
	}
	return { Authorization: `Bearer ${token}` };
}

const apiClient = createTRPCProxyClient<AppRouter>({
	links: [
		httpBatchLink({
			url: `${env.NEXT_PUBLIC_API_URL}/api/trpc`,
			transformer: superjson,
			headers: getAuthHeaders,
		}),
	],
});

export const createAtlasFeatureStudioRouter = () =>
	router({
		createRequest: publicProcedure
			.input(
				z.object({
					title: z.string().min(1).max(200),
					rawPrompt: z.string().min(1),
					summary: z.string().optional(),
					rulesetReference: z.string().optional(),
				}),
			)
			.mutation(async ({ input }) => {
				return apiClient.featureStudio.createRequest.mutate(input);
			}),

		getRequest: publicProcedure
			.input(z.object({ id: z.string().uuid() }))
			.query(async ({ input }) => {
				return apiClient.featureStudio.getRequest.query(input);
			}),

		listQueue: publicProcedure
			.input(
				z
					.object({
						status: z
							.enum([
								"draft",
								"spec_ready",
								"pending_spec_approval",
								"plan_approved",
								"implementing",
								"verifying",
								"preview_deploying",
								"agent_qa",
								"pending_human_qa",
								"customization",
								"pending_registration",
								"registered",
								"failed",
								"discarded",
							])
							.optional(),
					})
					.optional(),
			)
			.query(async ({ input }) => {
				return apiClient.featureStudio.listQueue.query(input);
			}),

		listReadyToRegister: publicProcedure.query(async () => {
			return apiClient.featureStudio.listReadyToRegister.query();
		}),

		advance: publicProcedure
			.input(z.object({ featureRequestId: z.string().uuid() }))
			.mutation(async ({ input }) => {
				return apiClient.featureStudio.advance.mutate(input);
			}),

		respondToApproval: publicProcedure
			.input(
				z.object({
					approvalId: z.string().uuid(),
					action: z.enum(["approved", "rejected", "discarded"]),
					feedback: z.string().optional(),
				}),
			)
			.mutation(async ({ input }) => {
				return apiClient.featureStudio.respondToApproval.mutate(input);
			}),

		requestRegistrationApproval: publicProcedure
			.input(z.object({ featureRequestId: z.string().uuid() }))
			.mutation(async ({ input }) => {
				return apiClient.featureStudio.requestRegistrationApproval.mutate(
					input,
				);
			}),

		registerRequest: publicProcedure
			.input(z.object({ featureRequestId: z.string().uuid() }))
			.mutation(async ({ input }) => {
				return apiClient.featureStudio.registerRequest.mutate(input);
			}),
	});

export type AtlasFeatureStudioRouter = ReturnType<
	typeof createAtlasFeatureStudioRouter
>;
