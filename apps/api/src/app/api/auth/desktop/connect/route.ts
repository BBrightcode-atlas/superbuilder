import { auth } from "@superset/auth/server";
import { NextResponse } from "next/server";

import { env } from "@/env";
import {
	getAuthSchemaReadiness,
	isMissingRelationError,
} from "@/lib/auth-schema";

export async function GET(request: Request) {
	const url = new URL(request.url);
	const provider = url.searchParams.get("provider");
	const state = url.searchParams.get("state");
	const protocol = url.searchParams.get("protocol");
	const localCallback = url.searchParams.get("local_callback");

	if (!provider || !state) {
		return new Response("Missing provider or state", { status: 400 });
	}

	if (provider !== "google" && provider !== "github") {
		return new Response("Invalid provider", { status: 400 });
	}

	const readiness = await getAuthSchemaReadiness();
	if (!readiness.ready) {
		return NextResponse.json(
			{
				error: "better_auth_schema_missing",
				message:
					"Better Auth schema is incomplete for this database. Apply the existing auth tables before starting desktop sign-in.",
				missingTables: readiness.missingTables,
			},
			{ status: 503 },
		);
	}

	const successUrl = new URL(`${env.NEXT_PUBLIC_WEB_URL}/auth/desktop/success`);
	successUrl.searchParams.set("desktop_state", state);
	if (protocol) {
		successUrl.searchParams.set("desktop_protocol", protocol);
	}
	if (localCallback) {
		try {
			const callbackUrl = new URL(localCallback);
			const isLoopback =
				callbackUrl.protocol === "http:" &&
				(callbackUrl.hostname === "127.0.0.1" ||
					callbackUrl.hostname === "localhost");
			if (isLoopback && callbackUrl.pathname === "/auth/callback") {
				successUrl.searchParams.set(
					"desktop_local_callback",
					callbackUrl.toString(),
				);
			}
		} catch {
			// Ignore invalid callback URLs and continue with deep-link flow.
		}
	}

	let result: Response;

	try {
		result = await auth.api.signInSocial({
			body: {
				provider,
				callbackURL: successUrl.toString(),
			},
			asResponse: true,
		});
	} catch (error) {
		if (isMissingRelationError(error)) {
			const latestReadiness = await getAuthSchemaReadiness();
			return NextResponse.json(
				{
					error: "better_auth_schema_missing",
					message:
						"Better Auth schema is incomplete for this database. Apply the existing auth tables before starting desktop sign-in.",
					missingTables: latestReadiness.missingTables,
				},
				{ status: 503 },
			);
		}

		throw error;
	}

	const cookies = result.headers.getSetCookie();
	const body = (await result.json()) as { url?: string; redirect?: boolean };

	if (!body.url) {
		return new Response(`Failed to initiate OAuth: ${JSON.stringify(body)}`, {
			status: 500,
		});
	}

	const response = NextResponse.redirect(body.url);
	for (const cookie of cookies) {
		response.headers.append("set-cookie", cookie);
	}

	return response;
}
