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
export type {
	RemoveInput,
	RemoveResult,
	ScaffoldInput,
	ScaffoldResult,
} from "./types";
