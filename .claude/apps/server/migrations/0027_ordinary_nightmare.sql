CREATE TABLE "fixture_service_versions" (
	"fixture_id" uuid NOT NULL,
	"service_version_id" uuid NOT NULL,
	CONSTRAINT "fixture_service_versions_fixture_id_service_version_id_pk" PRIMARY KEY("fixture_id","service_version_id")
);
--> statement-breakpoint
ALTER TABLE "fixtures" DROP CONSTRAINT "fixtures_service_version_id_service_versions_id_fk";
--> statement-breakpoint
ALTER TABLE "fixture_service_versions" ADD CONSTRAINT "fixture_service_versions_fixture_id_fixtures_id_fk" FOREIGN KEY ("fixture_id") REFERENCES "public"."fixtures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixture_service_versions" ADD CONSTRAINT "fixture_service_versions_service_version_id_service_versions_id_fk" FOREIGN KEY ("service_version_id") REFERENCES "public"."service_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixtures" DROP COLUMN "service_version_id";--> statement-breakpoint
ALTER TABLE "fixtures" DROP COLUMN "service_version_ids";