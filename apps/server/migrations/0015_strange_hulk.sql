ALTER TABLE "service_dependencies" DROP CONSTRAINT "service_dependencies_deployment_id_deployments_id_fk";
--> statement-breakpoint
ALTER TABLE "service_dependencies" DROP COLUMN "provider_version";--> statement-breakpoint
ALTER TABLE "service_dependencies" DROP COLUMN "environment";--> statement-breakpoint
ALTER TABLE "service_dependencies" DROP COLUMN "deployment_id";--> statement-breakpoint
ALTER TABLE "service_dependencies" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "service_dependencies" DROP COLUMN "verified_at";