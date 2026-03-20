import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [react(), tailwindcss()],
	resolve: {
		alias: [
			{
				find: "@/components/ui",
				replacement: resolve(
					__dirname,
					"../../packages/ui-preview/src/components/ui",
				),
			},
			{
				find: "@",
				replacement: resolve(__dirname, "src"),
			},
		],
	},
	server: {
		port: 4100,
		strictPort: true,
		cors: true,
	},
});
