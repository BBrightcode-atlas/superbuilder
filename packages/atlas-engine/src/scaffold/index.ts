export { scaffold } from "./scaffold";
export {
	DEFAULT_PATH_MAPPING,
	IMPORT_ALIAS_MAP,
	resolveSourcePath,
	resolveTargetPath,
} from "./path-mapping";
export type { PathSlot } from "./path-mapping";
export { buildProjectSpec, writeProjectSpec } from "./spec-writer";
export { cloneTemplate, initGitRepo } from "./template-clone";
export { sanitizeTemplate } from "./template-sanitizer";
export type { CloneOptions } from "./template-clone";
export {
	generateWorkflowMarkdown,
	writeInstallWorkflow,
} from "./workflow-writer";
export type { WorkflowWriterInput } from "./workflow-writer";
export type * from "./types";
