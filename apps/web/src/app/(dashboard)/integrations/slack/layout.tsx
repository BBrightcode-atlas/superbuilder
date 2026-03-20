import { auth } from "@superset/auth/server";
import { FEATURE_FLAGS } from "@superset/shared/constants";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { PostHog } from "posthog-node";

import { env } from "@/env";

export default async function SlackIntegrationLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session?.user) {
		notFound();
	}

	const hasAccess =
		env.NEXT_PUBLIC_POSTHOG_KEY && env.NEXT_PUBLIC_POSTHOG_HOST
			? await new PostHog(env.NEXT_PUBLIC_POSTHOG_KEY, {
					host: env.NEXT_PUBLIC_POSTHOG_HOST,
					flushAt: 1,
					flushInterval: 0,
				}).getFeatureFlag(
					FEATURE_FLAGS.SLACK_INTEGRATION_ACCESS,
					session.user.id,
				)
			: false;

	if (!hasAccess) {
		notFound();
	}

	return <>{children}</>;
}
