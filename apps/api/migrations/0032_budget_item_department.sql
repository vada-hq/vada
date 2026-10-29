ALTER TABLE budget_item ADD COLUMN department_id uuid REFERENCES department (id);
--> statement-breakpoint
CREATE INDEX ON budget_item (department_id);
