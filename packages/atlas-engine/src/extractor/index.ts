/**
 * @deprecated The subtractive extractor is replaced by the additive scaffold system.
 * Use `@superbuilder/atlas-engine/scaffold` instead.
 * See: docs/superpowers/specs/2026-03-13-composer-scaffold-agent-design.md
 */
export { extract } from "./extractor";
export type {
  ExtractorConfig,
  ExtractResult,
  SuperbuilderMetadata,
  ConnectionFileGenerator,
} from "./types";
export {
  generateSchemaIndex,
  generateDrizzleConfig,
  generateAppRouter,
  generateTrpcRouter,
  generateAppModule,
  generateClientRouter,
  generateAdminRouter,
  generateFeatureConfig,
} from "./generators";
