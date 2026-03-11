import { Module, OnModuleInit } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import {
	BrowserQaService,
	FeatureRequestService,
	FeatureStudioRunnerService,
	VercelPreviewService,
	WorktreeExecutionService,
} from "./service";
import { injectFeatureStudioServices } from "./trpc";

@Module({
	imports: [ConfigModule],
	providers: [
		FeatureRequestService,
		FeatureStudioRunnerService,
		WorktreeExecutionService,
		VercelPreviewService,
		BrowserQaService,
	],
	exports: [
		FeatureRequestService,
		FeatureStudioRunnerService,
		WorktreeExecutionService,
		VercelPreviewService,
		BrowserQaService,
	],
})
export class FeatureStudioModule implements OnModuleInit {
	constructor(
		private readonly featureRequestService: FeatureRequestService,
		private readonly featureStudioRunnerService: FeatureStudioRunnerService,
	) {}

	onModuleInit() {
		injectFeatureStudioServices({
			featureRequestService: this.featureRequestService,
			featureStudioRunnerService: this.featureStudioRunnerService,
		});
	}
}
