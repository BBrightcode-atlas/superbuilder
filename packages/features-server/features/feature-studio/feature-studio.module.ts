import { Module, OnModuleInit } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { FeatureCatalogModule } from "../feature-catalog/server";
import {
	BrowserQaService,
	FeatureRegistrationService,
	FeatureRequestService,
	FeatureStudioRunnerService,
	VercelPreviewService,
	WorktreeExecutionService,
} from "./service";
import { injectFeatureStudioServices } from "./trpc";

@Module({
	imports: [ConfigModule, FeatureCatalogModule],
	providers: [
		FeatureRequestService,
		FeatureRegistrationService,
		FeatureStudioRunnerService,
		WorktreeExecutionService,
		VercelPreviewService,
		BrowserQaService,
	],
	exports: [
		FeatureRequestService,
		FeatureRegistrationService,
		FeatureStudioRunnerService,
		WorktreeExecutionService,
		VercelPreviewService,
		BrowserQaService,
	],
})
export class FeatureStudioModule implements OnModuleInit {
	constructor(
		private readonly featureRegistrationService: FeatureRegistrationService,
		private readonly featureRequestService: FeatureRequestService,
		private readonly featureStudioRunnerService: FeatureStudioRunnerService,
	) {}

	onModuleInit() {
		injectFeatureStudioServices({
			featureRegistrationService: this.featureRegistrationService,
			featureRequestService: this.featureRequestService,
			featureStudioRunnerService: this.featureStudioRunnerService,
		});
	}
}
