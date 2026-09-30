ALTER TABLE "events" ADD CONSTRAINT "events_organization_id_unique" UNIQUE("organization_id","id");
--> statement-breakpoint
CREATE TABLE "chat_rooms" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"event_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_rooms_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"chat_room_id" text NOT NULL,
	"author_id" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "messages_content_not_blank" CHECK ("messages"."content" ~ '[^[:space:]]'),
	CONSTRAINT "messages_content_length" CHECK (char_length("messages"."content") <= 2000)
);
--> statement-breakpoint
ALTER TABLE "chat_rooms" ADD CONSTRAINT "chat_rooms_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_rooms" ADD CONSTRAINT "chat_rooms_event_same_organization" FOREIGN KEY ("organization_id","event_id") REFERENCES "public"."events"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_chat_room_id_chat_rooms_id_fk" FOREIGN KEY ("chat_room_id") REFERENCES "public"."chat_rooms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_rooms_organization_id_idx" ON "chat_rooms" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "messages_room_created_id_idx" ON "messages" USING btree ("chat_room_id","created_at","id");--> statement-breakpoint
-- 기존 행사에도 채팅방을 하나씩 연결한다. 새 테이블이므로 접두사 ID 충돌은 없다.
INSERT INTO "chat_rooms" ("id", "organization_id", "event_id", "created_at")
SELECT 'event-room:' || "id", "organization_id", "id", now() FROM "events";
