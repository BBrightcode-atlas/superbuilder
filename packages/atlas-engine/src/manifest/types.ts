/** Feature 타입 */
export type FeatureType = "page" | "widget" | "agent";

/** Feature 그룹 */
export type FeatureGroup =
	| "core"
	| "content"
	| "commerce"
	| "community"
	| "system"
	| "template";

/** Boilerplate에서의 피처 경로 */
export interface FeaturePaths {
	server?: string;
	client?: string;
	admin?: string;
	schema?: string;
	widget?: string;
}

/** Marker 기반 connection point */
export interface FeatureConnection {
	/** 파일 경로 (boilerplate root 기준) */
	file: string;
	/** Marker 이름 (e.g., "IMPORTS", "MODULES") */
	marker: string;
	/** 삽입된 코드 내용 */
	content: string;
}

/** Boilerplate manifest의 피처 항목 */
export interface ManifestFeature {
	name: string;
	type: FeatureType;
	group: FeatureGroup;
	description?: string;
	dependencies: string[];
	optionalDependencies: string[];
	/** 이 피처에 의존하는 피처 목록 */
	dependents: string[];
	/** Boilerplate 레포 내 경로 */
	paths: FeaturePaths;
	/** Marker 기반 connection points */
	connections: FeatureConnection[];
	/** 이 피처가 소유하는 DB 테이블 */
	tables: string[];
	/** tRPC router 정보 */
	router: {
		key: string;
		importName: string;
	};
}

/** Boilerplate manifest (superbuilder.json) */
export interface BoilerplateManifest {
	version: string;
	source: {
		repo: string;
		branch: string;
		lastSyncedCommit: string;
		syncedAt: string;
	};
	features: Record<string, ManifestFeature>;
}

/** 의존성 해결 결과 */
export interface ResolvedFeatures {
	/** 사용자가 직접 선택한 features */
	selected: string[];
	/** 의존성으로 자동 포함된 features */
	autoIncluded: string[];
	/** 최종 확정된 전체 features (토폴로지 순서) */
	resolved: string[];
	/** optional dependencies 중 포함 가능한 목록 */
	availableOptional: string[];
}

// ─────────────────────────────────────────────────────────────
// feature.json 기반 타입 (Backstage-style feature plugin system)
// ─────────────────────────────────────────────────────────────

/** feature.json — self-describing feature manifest */
export interface FeatureManifest {
	id: string;
	name: string;
	version: string;
	type: FeatureType;
	group: FeatureGroup;
	icon: string;
	description?: string;

	dependencies: string[];
	optionalDependencies?: string[];

	provides: Provides;
}

/** What the feature provides to extension points */
export interface Provides {
	server?: ServerProvides;
	client?: ClientProvides;
	admin?: AdminProvides;
	schema?: SchemaProvides;
	widget?: WidgetProvides;
}

export interface ServerProvides {
	/** NestJS Module class name (e.g. "BlogModule") */
	module: string;
	/** tRPC router variable name (e.g. "blogRouter") */
	router: string;
	/** tRPC router key in the merged router object (e.g. "blog") */
	routerKey: string;
}

export interface ClientProvides {
	/** Route factory function name (e.g. "createBlogRoutes") */
	routes: string;
}

export interface AdminProvides {
	/** Admin route factory function name (e.g. "createBlogAdminRoutes") */
	routes: string;
	/** Sidebar menu config */
	menu?: AdminMenuConfig;
}

export interface AdminMenuConfig {
	label: string;
	icon: string;
	order: number;
}

export interface SchemaProvides {
	/** DB table names managed by this feature */
	tables: string[];
}

export interface WidgetProvides {
	/** Main component name (e.g. "CommentSection") */
	component: string;
	/** Props the widget accepts */
	props?: string[];
}

// ─────────────────────────────────────────────────────────────
// FeatureRegistry — feature.json 스캔 결과를 담는 통합 레지스트리
// ─────────────────────────────────────────────────────────────

/** Feature registry produced by scanning feature.json manifests */
export interface FeatureRegistry {
	version: string;
	source: string;
	features: Record<string, FeatureEntry>;
	core: string[];
	groups: Record<
		string,
		{
			label: string;
			order: number;
		}
	>;
}

/** Individual feature entry in the registry */
export interface FeatureEntry {
	name: string;
	type: FeatureType;
	icon: string;
	group: FeatureGroup;
	description?: string;
	dependencies: string[];
	optionalDependencies: string[];
	router: {
		key: string;
		import: string;
		from: string;
	};
	server: {
		module: string;
		router?: string;
		controller?: string;
	};
	client: Record<string, string>;
	schema: {
		tables: string[];
		path: string;
	};
	widget?: {
		path: string;
		export: string;
	};
	admin?: {
		showInSidebar: boolean;
		path: string;
		label: string;
		order: number;
	};
}
