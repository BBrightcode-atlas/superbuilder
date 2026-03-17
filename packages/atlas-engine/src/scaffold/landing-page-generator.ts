import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { FeatureManifest, LandingPage } from "../manifest/types";

/**
 * B2B2C Landing 페이지 생성.
 *
 * provides.landing.pages 배열을 순회하며 Next.js page.tsx 파일을 생성한다.
 * - template: "widget-page" + ssr: true → RSC + serverTrpc prefetch
 * - template: "widget-page" + ssr: false → 클라이언트 컴포넌트만
 * - template: "custom" → 경고 출력 (수동 구현 필요)
 */
export async function generateLandingPages(
	templateDir: string,
	manifests: FeatureManifest[],
): Promise<void> {
	for (const manifest of manifests) {
		const pages = manifest.provides.landing?.pages;
		if (!pages) continue;

		for (const page of pages) {
			if (page.template === "custom") {
				console.log(
					`ℹ Feature "${manifest.id}"의 ${page.path} 페이지는 custom template입니다. 수동 구현 필요.`,
				);
				continue;
			}

			const pagePath = join(
				templateDir,
				"apps/landing/src/app/(public)",
				page.path,
				"page.tsx",
			);

			const content = generateWidgetPageContent(page, manifest.id);
			await mkdir(dirname(pagePath), { recursive: true });
			await writeFile(pagePath, content, "utf-8");
		}
	}
}

function generateWidgetPageContent(
	page: LandingPage,
	featureId: string,
): string {
	const widget = page.widget!;
	const pkg = widget.package.replace("@superbuilder/", "@repo/");
	const title = page.metadata?.title ?? featureId;
	const description = page.metadata?.description ?? "";
	const componentName = `${toPascalCase(featureId)}Page`;

	if (page.ssr && widget.initialDataProcedure) {
		const procedureChain = widget.initialDataProcedure
			.split(".")
			.map((part) => `.${part}`)
			.join("");

		return `import type { Metadata } from "next";
import { serverTrpc } from "@/lib/trpc";
import { ${widget.component} } from "${pkg}";

export const metadata: Metadata = {
  title: "${title}",
  description: "${description}",
};

export default async function ${componentName}() {
  const data = await serverTrpc${procedureChain}.query();
  return (
    <main>
      <${widget.component} initialData={data} />
    </main>
  );
}
`;
	}

	return `import type { Metadata } from "next";
import { ${widget.component} } from "${pkg}";

export const metadata: Metadata = {
  title: "${title}",
  description: "${description}",
};

export default function ${componentName}() {
  return (
    <main>
      <${widget.component} />
    </main>
  );
}
`;
}

function toPascalCase(str: string): string {
	return str
		.split(/[-_]/)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join("");
}
