import { describe, expect, it } from "bun:test";
import { transformImports } from "./import-transformer";

describe("transformImports", () => {
	it("rewrites ../../schema to @repo/drizzle/schema", () => {
		const source = `import { comments } from "../../schema";`;
		const result = transformImports(source);
		expect(result).toBe(`import { comments } from "@repo/drizzle/schema";`);
	});

	it("rewrites ../schema to @repo/drizzle/schema", () => {
		const source = `import { bookmarks } from "../schema";`;
		const result = transformImports(source);
		expect(result).toBe(`import { bookmarks } from "@repo/drizzle/schema";`);
	});

	it("rewrites ../../../schema to @repo/drizzle/schema", () => {
		const source = `import type { MarketingSnsAccount } from "../../../schema";`;
		const result = transformImports(source);
		expect(result).toBe(
			`import type { MarketingSnsAccount } from "@repo/drizzle/schema";`,
		);
	});

	it("rewrites ../schema/index.js to @repo/drizzle/schema", () => {
		const source = `import type { Foo } from "../schema/index.js";`;
		const result = transformImports(source);
		expect(result).toBe(
			`import type { Foo } from "@repo/drizzle/schema";`,
		);
	});

	it("handles single quotes", () => {
		const source = `import { reactions } from '../../schema';`;
		const result = transformImports(source);
		expect(result).toBe(`import { reactions } from '@repo/drizzle/schema';`);
	});

	it("preserves @repo/* imports unchanged", () => {
		const source = `import { user } from "@repo/drizzle/schema";
import { Button } from "@repo/ui/shadcn/button";`;
		const result = transformImports(source);
		expect(result).toBe(source);
	});

	it("preserves non-schema relative imports unchanged", () => {
		const source = `import { helper } from "../../utils";
import { Service } from "../service/foo.service";`;
		const result = transformImports(source);
		expect(result).toBe(source);
	});

	it("preserves third-party imports unchanged", () => {
		const source = `import React from "react";
import { useQuery } from "@tanstack/react-query";`;
		const result = transformImports(source);
		expect(result).toBe(source);
	});
});
