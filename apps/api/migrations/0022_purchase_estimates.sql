-- Custom SQL migration file, put your code below! --
-- 예상값은 승인 금액과 분리한다(024-11, DEC-92). 기존 행/판과 승인 금액은 바꾸지 않는다.
ALTER TABLE line_item
  ADD COLUMN estimated_unit_price numeric(14,0),
  ADD COLUMN estimated_shipping_fee numeric(14,0),
  ADD CONSTRAINT line_item_estimated_unit_price_check
    CHECK (estimated_unit_price BETWEEN 0 AND 1000000000),
  ADD CONSTRAINT line_item_estimated_shipping_fee_check
    CHECK (estimated_shipping_fee BETWEEN 0 AND 1000000000),
  ADD CONSTRAINT line_item_estimated_total_check
    CHECK (quantity * estimated_unit_price + coalesce(estimated_shipping_fee, 0) <= 1000000000);
