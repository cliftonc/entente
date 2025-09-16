CREATE INDEX "user_sessions_user_idx" ON "user_sessions" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE INDEX "user_sessions_expiration_idx" ON "user_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "tenant_users_user_idx" ON "tenant_users" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tenant_users_tenant_idx" ON "tenant_users" USING btree ("tenant_id","role");--> statement-breakpoint
CREATE INDEX "keys_validation_idx" ON "keys" USING btree ("key_hash","is_active","revoked_at");--> statement-breakpoint
CREATE INDEX "keys_tenant_idx" ON "keys" USING btree ("tenant_id","is_active");--> statement-breakpoint
CREATE INDEX "keys_hash_update_idx" ON "keys" USING btree ("key_hash");