import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import { z } from "zod";
import { env } from "main/env.main";
import { loadToken } from "../auth/utils/auth-functions";
import { publicProcedure, router } from "../..";
import type { FeatureStudioContractRouter } from "./feature-studio-contract";

function isJwtToken(token: string): boolean {
	return token.split(".").length === 3;
}

async function exchangeSessionTokenForJwt(
	sessionToken: string,
): Promise<string | null> {
	try {
		const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/api/auth/token`, {
			headers: {
				Authorization: `Bearer ${sessionToken}`,
			},
		});
		if (!response.ok) {
			console.warn(
				"[feature-studio] failed to exchange desktop session token for JWT",
				response.status,
				response.statusText,
			);
			return null;
		}
		const data = (await response.json()) as { token?: string };
		return data.token ?? null;
	} catch (error) {
		console.warn(
			"[feature-studio] failed to reach auth token endpoint",
			error,
		);
		return null;
	}
}

async function getFeatureStudioAuthorizationHeader(): Promise<
	Record<string, string>
> {
	const { token } = await loadToken();
	if (!token) {
		return {};
	}

	if (isJwtToken(token)) {
		return {
			Authorization: `Bearer ${token}`,
		};
	}

	const jwt = await exchangeSessionTokenForJwt(token);
	if (!jwt) {
		return {};
	}

	return {
		Authorization: `Bearer ${jwt}`,
	};
}

const featureStudioClient = createTRPCProxyClient<FeatureStudioContractRouter>({
	links: [
		httpBatchLink({
			url: `${env.FEATURES_SERVER_URL}/trpc`,
			headers: getFeatureStudioAuthorizationHeader,
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
				return featureStudioClient.createRequest.mutate(input);
			}),

		getRequest: publicProcedure
			.input(z.object({ id: z.string().uuid() }))
			.query(async ({ input }) => {
				return featureStudioClient.getRequest.query(input);
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
				return featureStudioClient.listQueue.query(input);
			}),

		listReadyToRegister: publicProcedure.query(async () => {
			return featureStudioClient.listReadyToRegister.query();
		}),

		advance: publicProcedure
			.input(z.object({ featureRequestId: z.string().uuid() }))
			.mutation(async ({ input }) => {
				return featureStudioClient.advance.mutate(input);
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
				return featureStudioClient.respondToApproval.mutate(input);
			}),

		requestRegistrationApproval: publicProcedure
			.input(z.object({ featureRequestId: z.string().uuid() }))
			.mutation(async ({ input }) => {
				return featureStudioClient.requestRegistrationApproval.mutate(input);
			}),

		registerRequest: publicProcedure
			.input(z.object({ featureRequestId: z.string().uuid() }))
			.mutation(async ({ input }) => {
				return featureStudioClient.registerRequest.mutate(input);
			}),
	});

export type AtlasFeatureStudioRouter = ReturnType<
	typeof createAtlasFeatureStudioRouter
>;
