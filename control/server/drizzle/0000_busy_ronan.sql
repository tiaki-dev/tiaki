CREATE TYPE "public"."agent_status" AS ENUM('online', 'offline', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."agent_type" AS ENUM('vm', 'k8s');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('sent', 'failed', 'pending');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('email', 'webhook');--> statement-breakpoint
CREATE TYPE "public"."update_status" AS ENUM('pending', 'approved', 'deployed', 'ignored', 'failed');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agents" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" "agent_type" NOT NULL,
	"api_key_hash" text NOT NULL,
	"status" "agent_status" DEFAULT 'unknown' NOT NULL,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "containers" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"container_id" text NOT NULL,
	"name" text NOT NULL,
	"image" text NOT NULL,
	"current_tag" text NOT NULL,
	"current_digest" text,
	"compose_file" text,
	"compose_service" text,
	"namespace" text,
	"last_scanned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"type" "notification_type" NOT NULL,
	"recipient" text NOT NULL,
	"update_result_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sent_at" timestamp with time zone,
	"status" "notification_status" DEFAULT 'pending' NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "policies" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"agent_id" text,
	"image_pattern" text NOT NULL,
	"auto_approve" boolean DEFAULT false NOT NULL,
	"notify_channels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "update_results" (
	"id" text PRIMARY KEY NOT NULL,
	"container_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"current_tag" text NOT NULL,
	"latest_tag" text NOT NULL,
	"latest_digest" text,
	"previous_tag" text,
	"previous_digest" text,
	"status" "update_status" DEFAULT 'pending' NOT NULL,
	"changelog_url" text,
	"found_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deployed_at" timestamp with time zone,
	"deployed_by" text,
	"deploy_log" text
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "containers" ADD CONSTRAINT "containers_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "policies" ADD CONSTRAINT "policies_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "update_results" ADD CONSTRAINT "update_results_container_id_containers_id_fk" FOREIGN KEY ("container_id") REFERENCES "public"."containers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "update_results" ADD CONSTRAINT "update_results_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
