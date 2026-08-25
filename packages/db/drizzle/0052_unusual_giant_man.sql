CREATE INDEX "idx_ov_org_status" ON "organization_vendors" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "idx_ov_org_risk" ON "organization_vendors" USING btree ("organization_id","risk_score");--> statement-breakpoint
CREATE INDEX "idx_ov_org_review" ON "organization_vendors" USING btree ("organization_id","next_review_at");