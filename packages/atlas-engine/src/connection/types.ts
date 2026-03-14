export interface DerivedConnections {
	nestModuleImport?: string;
	nestModuleRef?: string;
	trpcRouterImport?: string;
	trpcRouterKey?: string;
	trpcTypeImport?: string;
	trpcTypeKey?: string;
	clientRoutesImport?: string;
	clientRoutesSpread?: string;
	adminRoutesImport?: string;
	adminRoutesSpread?: string;
	adminMenu?: string;
	schemaExport?: string;
	tablesFilter?: string;
	widgetExport?: { subpath: string; entry: string };
}
