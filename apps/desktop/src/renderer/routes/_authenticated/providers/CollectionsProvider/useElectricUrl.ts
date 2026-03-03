import { FEATURE_FLAGS } from "@superset/shared/constants";
import { useFeatureFlagEnabled } from "posthog-js/react";
import { env } from "renderer/env.renderer";
import { setElectricUrl } from "./collections";

/**
 * Resolves the Electric URL based on the `electric-cloud` feature flag.
 * Blocks rendering (returns `ready: false`) until PostHog has loaded the flag,
 * ensuring `setElectricUrl` runs before any collections are created.
 */
export function useElectricUrl(): { ready: boolean } {
	const useElectricCloud = useFeatureFlagEnabled(FEATURE_FLAGS.ELECTRIC_CLOUD);

	if (useElectricCloud === undefined) {
		return { ready: false };
	}

	if (useElectricCloud) {
		setElectricUrl(env.NEXT_PUBLIC_ELECTRIC_URL);
	}

	return { ready: true };
}
