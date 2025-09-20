CREATE INDEX "idx_specs_spec_type" ON "specs" USING btree ("spec_type");--> statement-breakpoint
CREATE INDEX "idx_specs_service_spec_type" ON "specs" USING btree ("service","spec_type");--> statement-breakpoint
CREATE INDEX "idx_fixtures_spec_type" ON "fixtures" USING btree ("spec_type");--> statement-breakpoint
CREATE INDEX "idx_fixtures_service_spec_type" ON "fixtures" USING btree ("service","spec_type");--> statement-breakpoint
ALTER TABLE "specs" ADD CONSTRAINT "specs_spec_type_check" CHECK ("specs"."spec_type" IN ('openapi', 'graphql', 'asyncapi', 'grpc', 'soap'));--> statement-breakpoint
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_spec_type_check" CHECK ("fixtures"."spec_type" IN ('openapi', 'graphql', 'asyncapi', 'grpc', 'soap'));