import type { FeatureEntry, FeatureRegistry } from "../registry/types";
import type { ResolvedFeatures } from "../resolver/types";

/** Extractor 설정 */
export interface ExtractorConfig {
  /** Feature Atlas 소스 디렉토리 경로 */
  sourcePath: string;
  /** 추출 결과를 저장할 대상 디렉토리 경로 */
  targetPath: string;
  /** 로드된 Feature Registry */
  registry: FeatureRegistry;
  /** 의존성 해결 결과 */
  resolved: ResolvedFeatures;
}

/** 추출 결과 */
export interface ExtractResult {
  /** 대상 디렉토리 경로 */
  targetPath: string;
  /** 포함된 feature 목록 (resolved) */
  features: string[];
  /** 제거된 feature 디렉토리 목록 */
  removedDirs: string[];
  /** 재생성된 connection file 목록 */
  regeneratedFiles: string[];
  /** superbuilder.json 경로 */
  metadataPath: string;
}

/** superbuilder.json 메타데이터 */
export interface SuperbuilderMetadata {
  source: string;
  sourceVersion: string;
  createdAt: string;
  createdBy: string;
  features: string[];
  resolvedFeatures: string[];
  env: {
    infrastructure: string[];
    feature: string[];
  };
}

/** Connection file generator 함수 시그니처 */
export type ConnectionFileGenerator = (
  targetPath: string,
  selectedFeatures: string[],
  registry: FeatureRegistry,
) => string;
