export { copyFeaturesToTemplate } from "./copy-features";
export { generateRemovalWorkflow, removeFeatures } from "./feature-remover";
export type { PathMapping, PathSlot } from "./path-mapping";
export {
	FEATURE_JSON_PATH_MAPPING,
	resolveFeatureJsonSourcePath,
	resolveFeatureJsonTargetPath,
} from "./path-mapping";
export type { RegisterInput, RegisterResult } from "./register";
export { registerToBoilerplate } from "./register";
export { scaffold } from "./scaffold";
export { scaffoldB2B2C } from "./scaffold-b2b2c";
export { copyFeaturesB2B2C } from "./copy-features-b2b2c";
export { generateLandingPages } from "./landing-page-generator";
export type { B2B2CPathSlot } from "./path-mapping-b2b2c";
export { transformDirectory } from "./transform-files";
export type {
	RemoveInput,
	RemoveResult,
	ScaffoldInput,
	ScaffoldResult,
} from "./types";
export { updateFeatureExports } from "./update-package-exports";
