ALTER TABLE "meeting_agendas" ADD COLUMN "no_decision" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "meeting_agendas" ADD COLUMN "no_follow_up" boolean DEFAULT false NOT NULL;