-- 옛 요청서 연결을 지운다. FK와 고유 제약이 서로 기대므로 기대는 쪽부터 지운다.
-- CASCADE를 쓰지 않는다. 모르는 의존 객체가 있으면 함께 지우지 않고 실패한다.
ALTER TABLE "shipment_items" DROP CONSTRAINT "shipment_items_item_same_request";--> statement-breakpoint
ALTER TABLE "shipment_items" DROP CONSTRAINT "shipment_items_request_same_organization";--> statement-breakpoint
DROP INDEX "shipment_items_request_idx";--> statement-breakpoint
ALTER TABLE "shipment_items" DROP COLUMN "request_id";--> statement-breakpoint
ALTER TABLE "purchase_items" DROP CONSTRAINT "purchase_items_request_id_purchase_requests_id_fk";--> statement-breakpoint
ALTER TABLE "purchase_items" DROP CONSTRAINT "purchase_items_request_position_unique";--> statement-breakpoint
ALTER TABLE "purchase_items" DROP CONSTRAINT "purchase_items_request_id_unique";--> statement-breakpoint
ALTER TABLE "purchase_items" DROP CONSTRAINT "purchase_items_position_nonnegative";--> statement-breakpoint
ALTER TABLE "purchase_items" DROP COLUMN "request_id";--> statement-breakpoint
ALTER TABLE "purchase_items" DROP COLUMN "position";--> statement-breakpoint
DROP TABLE "purchase_request_history";--> statement-breakpoint
DROP TABLE "purchase_request_sources";--> statement-breakpoint
DROP TABLE "purchase_requests";--> statement-breakpoint
-- 송장 연결은 같은 학생회의 품목만 가리킨다. 색인은 품목별 송장 조회와 이 FK 검사가 같이 쓴다.
ALTER TABLE "shipment_items" ADD CONSTRAINT "shipment_items_item_same_organization" FOREIGN KEY ("organization_id","purchase_item_id") REFERENCES "public"."purchase_items"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shipment_items_item_idx" ON "shipment_items" USING btree ("organization_id","purchase_item_id");--> statement-breakpoint
-- 상품 칸은 계약과 같은 길이(500·200·50자)까지만 넣고, 공백만은 넣지 않는다. 적용 전에 두 DB의 위반 행이 0건인지 확인한다.
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_product_name_not_blank" CHECK ("purchase_items"."product_name" ~ '[^[:space:]]');--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_product_name_length" CHECK (char_length("purchase_items"."product_name") <= 500);--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_selected_option_not_blank" CHECK ("purchase_items"."selected_option" ~ '[^[:space:]]');--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_selected_option_length" CHECK (char_length("purchase_items"."selected_option") <= 200);--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_packaging_unit_not_blank" CHECK ("purchase_items"."packaging_unit" ~ '[^[:space:]]');--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_packaging_unit_length" CHECK (char_length("purchase_items"."packaging_unit") <= 50);
