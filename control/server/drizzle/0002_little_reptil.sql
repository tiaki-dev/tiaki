CREATE TYPE "public"."audit_action" AS ENUM('approved', 'ignored', 'deployed', 'failed', 'rollback_requested', 'rollback_completed', 'rollback_failed');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"update_result_id" text NOT NULL,
	"action" "audit_action" NOT NULL,
	"actor" text DEFAULT 'system' NOT NULL,
	"detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_update_result_id_update_results_id_fk" FOREIGN KEY ("update_result_id") REFERENCES "public"."update_results"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
