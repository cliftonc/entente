ALTER TABLE "fixtures" ADD COLUMN "hash" varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_tenant_id_hash_unique" UNIQUE("tenant_id","hash");