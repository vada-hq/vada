-- 배송은 기록이며, 상태는 저장하지 않는다(DEC-61·74·92).
ALTER TABLE record DROP CONSTRAINT record_kind_check;
--> statement-breakpoint
ALTER TABLE record ADD CONSTRAINT record_kind_check CHECK (kind IN (
                 'council', 'cohort', 'member', 'council_membership', 'department',
                 'department_membership', 'audit_body', 'voting_body', 'fiscal_period',
                 'budget', 'budget_item', 'income', 'expense', 'payment_line', 'evidence',
                 'account_closing', 'fee_payment', 'deposit', 'account', 'event', 'task', 'request',
                 'line_item', 'registration_form', 'registration', 'attendance', 'meeting', 'agenda_item', 'poll',
                 'poll_option', 'poll_response', 'approval', 'decision', 'document',
                 'draft_item', 'source', 'chat_room', 'message', 'file', 'notification', 'shipment'));
--> statement-breakpoint
CREATE TABLE shipment (
  id uuid PRIMARY KEY,
  kind text NOT NULL DEFAULT 'shipment' CHECK (kind = 'shipment'),
  council_id uuid NOT NULL,
  request_id uuid NOT NULL REFERENCES request (id),
  carrier_id text NOT NULL CHECK (carrier_id IN ('kr.coupangls', 'kr.cjlogistics', 'kr.hanjin', 'kr.lotte', 'kr.epost', 'kr.logen')),
  tracking_number text NOT NULL CHECK (char_length(tracking_number) BETWEEN 1 AND 50 AND tracking_number ~ '^[0-9-]+$' AND tracking_number ~ '[0-9]'),
  cancelled_at timestamptz,
  FOREIGN KEY (id, kind) REFERENCES record (id, kind),
  FOREIGN KEY (id, council_id) REFERENCES record (id, council_id),
  FOREIGN KEY (request_id, council_id) REFERENCES record (id, council_id),
  UNIQUE (id, council_id)
);
--> statement-breakpoint
CREATE TABLE shipment_item (
  shipment_id uuid NOT NULL,
  line_item_id uuid NOT NULL REFERENCES line_item (id),
  council_id uuid NOT NULL,
  PRIMARY KEY (shipment_id, line_item_id),
  FOREIGN KEY (shipment_id, council_id) REFERENCES shipment (id, council_id),
  FOREIGN KEY (line_item_id, council_id) REFERENCES record (id, council_id)
);
--> statement-breakpoint
CREATE INDEX ON shipment (request_id);
--> statement-breakpoint
CREATE INDEX ON shipment (council_id);
--> statement-breakpoint
CREATE INDEX ON shipment_item (line_item_id);
