import type { BoilerplateManifest } from "../manifest/types";

/** Scaffold 입력 */
export interface ScaffoldInput {
	/** 프로젝트 이름 */
	projectName: string;
	/** 생성할 디렉토리 경로 */
	targetDir: string;
	/** 유지할 피처 목록 (나머지 제거) */
	featuresToKeep: string[];
	/** Boilerplate repo override (default: superbuilder-app-boilerplate) */
	boilerplateRepo?: string;
}

/** Scaffold 결과 */
export interface ScaffoldResult {
	projectDir: string;
	manifest: BoilerplateManifest;
	removedFeatures: string[];
	keptFeatures: string[];
}

/** Feature 제거 입력 */
export interface RemoveInput {
	/** 프로젝트 경로 */
	projectPath: string;
	/** 제거할 피처 목록 */
	featuresToRemove: string[];
	/** 현재 manifest */
	manifest: BoilerplateManifest;
}

/** Feature 제거 결과 */
export interface RemoveResult {
	/** 실제 제거된 피처 (의존 피처 포함) */
	removed: string[];
	/** 유지된 피처 */
	kept: string[];
	/** 업데이트된 manifest */
	manifest: BoilerplateManifest;
}
