-- 초대 코드 8자리. 헷갈리는 0·1·I·O를 뺀 32자에서, 글자마다 새 UUID의 첫 바이트(무작위)로 고른다.
CREATE FUNCTION vada_invite_code() RETURNS text LANGUAGE sql VOLATILE AS $$
  SELECT string_agg(substr('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', get_byte(uuid_send(gen_random_uuid()), 0) % 32 + 1, 1), '')
  FROM generate_series(1, 8)
$$;--> statement-breakpoint
ALTER TABLE "memberships" ALTER COLUMN "department_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_requests" ALTER COLUMN "department_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "invite_code" text DEFAULT vada_invite_code() NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_invite_code_unique" UNIQUE("invite_code");--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_invite_code_format" CHECK ("organizations"."invite_code" ~ '^[2-9A-HJ-NP-Z]{8}$');