import { Module, OnModuleInit } from "@nestjs/common";
import { FeatureRequestService } from "./service";
import { injectFeatureStudioServices } from "./trpc";

@Module({
  providers: [FeatureRequestService],
  exports: [FeatureRequestService],
})
export class FeatureStudioModule implements OnModuleInit {
  constructor(
    private readonly featureRequestService: FeatureRequestService,
  ) {}

  onModuleInit() {
    injectFeatureStudioServices({
      featureRequestService: this.featureRequestService,
    });
  }
}
