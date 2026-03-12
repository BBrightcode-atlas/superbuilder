import { router } from "../..";
import { createAtlasComposerRouter } from "./composer";
import { createAtlasDeploymentsRouter } from "./deployments";
import { createAtlasFeatureStudioRouter } from "./feature-studio";
import { createAtlasRegistryRouter } from "./registry";
import { createAtlasResolverRouter } from "./resolver";
import { createAtlasNeonRouter } from "./neon";
import { createAtlasVercelRouter } from "./vercel";

export const createAtlasRouter = () =>
	router({
		registry: createAtlasRegistryRouter(),
		featureStudio: createAtlasFeatureStudioRouter(),
		resolver: createAtlasResolverRouter(),
		composer: createAtlasComposerRouter(),
		deployments: createAtlasDeploymentsRouter(),
		neon: createAtlasNeonRouter(),
		vercel: createAtlasVercelRouter(),
	});
