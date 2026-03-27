export interface McpConfig {
	mcpServers: Record<string, McpServerConfig>;
}

interface McpServerConfig {
	command?: string;
	args?: string[];
	env?: Record<string, string>;
	type?: string;
	url?: string;
}

export function generateMcpJson(): McpConfig {
	return {
		mcpServers: {
			neon: {
				command: "npx",
				args: ["-y", "@neondatabase/mcp-server-neon"],
				env: { NEON_API_KEY: "${NEON_API_KEY}" },
			},
			"superbuilder-mcp": {
				type: "url",
				url: "https://superbuilder-ui.vercel.app/mcp",
			},
		},
	};
}
