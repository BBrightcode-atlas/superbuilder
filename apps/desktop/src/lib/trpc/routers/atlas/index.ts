import { router } from "../..";
import { createAtlasComposerRouter } from "./composer";
import { createAtlasDeploymentsRouter } from "./deployments";
import { createAtlasRegistryRouter } from "./registry";
import { createAtlasResolverRouter } from "./resolver";
import { createAtlasSupabaseRouter } from "./supabase";

export const createAtlasRouter = () =>
	router({
		registry: createAtlasRegistryRouter(),
		resolver: createAtlasResolverRouter(),
		composer: createAtlasComposerRouter(),
		deployments: createAtlasDeploymentsRouter(),
		supabase: createAtlasSupabaseRouter(),
	});
