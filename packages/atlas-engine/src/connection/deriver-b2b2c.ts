import type { Provides } from "../manifest/types";
import { deriveConnections } from "./deriver";
import type { DerivedConnections } from "./types";

export interface B2B2CDerivedConnections extends DerivedConnections {
	landingImports?: string;
	landingSitemap?: string;
	landingLlmsImports?: string;
	landingLlmsPages?: string;
	landingProviderImports?: string;
}

/**
 * B2B2C connection deriver.
 *
 * 기존 deriveConnections()로 server/admin/schema/widget 스니펫을 생성한 뒤,
 * client 관련 필드를 제거하고 landing 마커 스니펫을 추가한다.
 */
export function deriveConnectionsB2B2C(
	featureId: string,
	provides: Provides,
): B2B2CDerivedConnections {
	const base = deriveConnections(featureId, provides);

	const conn: B2B2CDerivedConnections = { ...base };
	delete conn.clientRoutesImport;
	delete conn.clientRoutesSpread;

	if (provides.landing?.pages) {
		const pages = provides.landing.pages;

		// LANDING_IMPORTS — 위젯 컴포넌트 import
		const imports = pages
			.filter((p) => p.template === "widget-page" && p.widget)
			.map((p) => {
				const pkg = p.widget!.package.replace(
					"@superbuilder/",
					"@repo/",
				);
				return `import { ${p.widget!.component} } from "${pkg}";`;
			});
		if (imports.length > 0) {
			conn.landingImports = imports.join("\n");
		}

		// LANDING_SITEMAP — URL 엔트리
		const sitemapEntries = pages
			.map((p) => `  { url: "${p.path}", lastModified: new Date() },`)
			.join("\n");
		if (sitemapEntries) {
			conn.landingSitemap = sitemapEntries;
		}

		// LANDING_LLMS_PAGES — 페이지 링크
		const llmsPages = pages
			.filter((p) => p.metadata)
			.map(
				(p) =>
					`  { title: "${p.metadata!.title}", url: "${p.path}", description: "${p.metadata!.description ?? ""}" },`,
			)
			.join("\n");
		if (llmsPages) {
			conn.landingLlmsPages = llmsPages;
		}
	}

	return conn;
}
