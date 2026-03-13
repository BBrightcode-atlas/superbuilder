// Module
export { ReactionModule } from "./reaction.module";

// Controller
export { ReactionController } from "./controller";

// tRPC Router
export { reactionRouter } from "./trpc";
export type { ReactionRouter } from "./trpc";

// Services
export { ReactionService } from "./service";

// Schema - now centralized in @superbuilder/features-db
// Use: import { reactions } from "@superbuilder/features-db"
