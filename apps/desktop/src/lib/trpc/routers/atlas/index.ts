import { router } from "../..";
import { createAtlasComposerRouter } from "./composer";
import { createAtlasDeploymentsRouter } from "./deployments";
import { createAtlasFeatureQueueRouter } from "./feature-queue";
import { createAtlasFeatureStudioRouter } from "./feature-studio";
import { createAtlasNeonRouter } from "./neon";
import { createAtlasRegistryRouter } from "./registry";
import { createAtlasResolverRouter } from "./resolver";
import { createAtlasVercelRouter } from "./vercel";

export const createAtlasRouter = () =>
	router({
		registry: createAtlasRegistryRouter(),
		featureQueue: createAtlasFeatureQueueRouter(),
		featureStudio: createAtlasFeatureStudioRouter(),
		resolver: createAtlasResolverRouter(),
		composer: createAtlasComposerRouter(),
		deployments: createAtlasDeploymentsRouter(),
		neon: createAtlasNeonRouter(),
		vercel: createAtlasVercelRouter(),
	});
