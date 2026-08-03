"""구매 요청 R1 데이터 구조를 확장 단계로 추가한다.

Revision ID: 20260803_0001
Revises:
Create Date: 2026-08-03
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260803_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# 초기 greenfield 변경이며 upgrade에는 rename/drop이 없는 expand만 포함한다.
phase: str = "expand"


_CREATE_JSONB_KEYS_FUNCTION = """
CREATE FUNCTION vada_jsonb_object_has_only_keys_r1(
    document jsonb,
    allowed_keys text[]
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
AS $$
    SELECT jsonb_typeof(document) = 'object'
       AND NOT EXISTS (
           SELECT 1
           FROM jsonb_object_keys(document) AS present_key
           WHERE NOT (present_key = ANY (allowed_keys))
       )
$$
"""


_CREATE_DRAFT_VALIDATOR = """
CREATE FUNCTION vada_purchase_request_draft_content_r1_is_valid(content jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
STRICT
PARALLEL SAFE
AS $$
DECLARE
    draft_item jsonb;
    evidence jsonb;
    details_value jsonb;
    nested_value jsonb;
    field_name text;
BEGIN
    IF jsonb_typeof(content) <> 'object'
       OR NOT vada_jsonb_object_has_only_keys_r1(
           content,
           ARRAY['title', 'neededDate', 'purpose', 'priority', 'items']
       ) THEN
        RETURN false;
    END IF;

    FOREACH field_name IN ARRAY ARRAY['title', 'neededDate', 'purpose'] LOOP
        IF content ? field_name AND jsonb_typeof(content -> field_name) <> 'string' THEN
            RETURN false;
        END IF;
    END LOOP;

    IF content ? 'priority'
       AND jsonb_typeof(content -> 'priority') NOT IN ('null', 'string') THEN
        RETURN false;
    END IF;
    IF jsonb_typeof(content -> 'priority') = 'string'
       AND content ->> 'priority' NOT IN ('normal', 'urgent') THEN
        RETURN false;
    END IF;

    IF content ? 'items' AND jsonb_typeof(content -> 'items') <> 'array' THEN
        RETURN false;
    END IF;
    IF NOT (content ? 'items') THEN
        RETURN true;
    END IF;

    FOR draft_item IN SELECT value FROM jsonb_array_elements(content -> 'items') LOOP
        IF jsonb_typeof(draft_item) <> 'object'
           OR NOT vada_jsonb_object_has_only_keys_r1(
               draft_item,
               ARRAY[
                   'name', 'category', 'budgetItem', 'purchaseType', 'quantity',
                   'unit', 'estimatedUnitPrice', 'priceEvidence', 'details'
               ]
           ) THEN
            RETURN false;
        END IF;

        FOREACH field_name IN ARRAY ARRAY['name', 'category', 'budgetItem', 'unit'] LOOP
            IF draft_item ? field_name
               AND jsonb_typeof(draft_item -> field_name) <> 'string' THEN
                RETURN false;
            END IF;
        END LOOP;

        IF draft_item ? 'purchaseType'
           AND jsonb_typeof(draft_item -> 'purchaseType') NOT IN ('null', 'string') THEN
            RETURN false;
        END IF;
        IF jsonb_typeof(draft_item -> 'purchaseType') = 'string'
           AND draft_item ->> 'purchaseType' NOT IN (
               'general', 'manufacturing_printing', 'rental', 'service'
           ) THEN
            RETURN false;
        END IF;

        IF draft_item ? 'quantity'
           AND jsonb_typeof(draft_item -> 'quantity') NOT IN ('null', 'number') THEN
            RETURN false;
        END IF;
        IF draft_item ? 'estimatedUnitPrice'
               AND jsonb_typeof(draft_item -> 'estimatedUnitPrice')
                   NOT IN ('null', 'number') THEN
            RETURN false;
        END IF;
        IF jsonb_typeof(draft_item -> 'estimatedUnitPrice') = 'number'
           AND (draft_item ->> 'estimatedUnitPrice')::numeric
               <> trunc((draft_item ->> 'estimatedUnitPrice')::numeric) THEN
            RETURN false;
        END IF;

        IF draft_item ? 'priceEvidence'
           AND jsonb_typeof(draft_item -> 'priceEvidence') <> 'array' THEN
            RETURN false;
        END IF;
        IF draft_item ? 'priceEvidence' THEN
            FOR evidence IN
                SELECT value FROM jsonb_array_elements(draft_item -> 'priceEvidence')
            LOOP
                IF jsonb_typeof(evidence) <> 'object'
                   OR NOT vada_jsonb_object_has_only_keys_r1(
                       evidence,
                       ARRAY['type', 'url', 'vendorName', 'fileRef', 'note']
                   ) THEN
                    RETURN false;
                END IF;
                IF evidence ? 'type'
                   AND (
                       jsonb_typeof(evidence -> 'type') <> 'string'
                       OR evidence ->> 'type' NOT IN (
                           'product_url', 'vendor', 'price_screenshot', 'vendor_quote'
                       )
                   ) THEN
                    RETURN false;
                END IF;
                FOREACH field_name IN ARRAY ARRAY[
                    'url', 'vendorName', 'fileRef', 'note'
                ] LOOP
                    IF evidence ? field_name
                       AND jsonb_typeof(evidence -> field_name) <> 'string' THEN
                        RETURN false;
                    END IF;
                END LOOP;
            END LOOP;
        END IF;

        IF draft_item ? 'details'
           AND jsonb_typeof(draft_item -> 'details') <> 'object' THEN
            RETURN false;
        END IF;
        IF draft_item ? 'details' THEN
            details_value := draft_item -> 'details';
            IF NOT vada_jsonb_object_has_only_keys_r1(
                details_value,
                ARRAY[
                    'vendor', 'productUrl', 'options', 'deliveryRequest', 'itemKind',
                    'specification', 'color', 'optionQuantities', 'printMethod',
                    'deliveryDate', 'fileRefs', 'requestNote', 'pickupLocation',
                    'startDate', 'endDate', 'contact', 'depositAmount', 'conditions',
                    'provider', 'location', 'scope'
                ]
            ) THEN
                RETURN false;
            END IF;

            FOREACH field_name IN ARRAY ARRAY[
                'vendor', 'productUrl', 'options', 'deliveryRequest', 'itemKind',
                'specification', 'color', 'printMethod', 'deliveryDate', 'requestNote',
                'pickupLocation', 'startDate', 'endDate', 'contact', 'conditions',
                'provider', 'location', 'scope'
            ] LOOP
                IF details_value ? field_name
                   AND jsonb_typeof(details_value -> field_name) <> 'string' THEN
                    RETURN false;
                END IF;
            END LOOP;

            IF details_value ? 'optionQuantities'
               AND jsonb_typeof(details_value -> 'optionQuantities') <> 'object' THEN
                RETURN false;
            END IF;
            IF details_value ? 'optionQuantities' THEN
                FOR nested_value IN
                    SELECT value FROM jsonb_each(details_value -> 'optionQuantities')
                LOOP
                    IF jsonb_typeof(nested_value) NOT IN ('null', 'number') THEN
                        RETURN false;
                    END IF;
                END LOOP;
            END IF;

            IF details_value ? 'fileRefs'
               AND jsonb_typeof(details_value -> 'fileRefs') <> 'array' THEN
                RETURN false;
            END IF;
            IF details_value ? 'fileRefs' THEN
                FOR nested_value IN
                    SELECT value FROM jsonb_array_elements(details_value -> 'fileRefs')
                LOOP
                    IF jsonb_typeof(nested_value) <> 'string' THEN
                        RETURN false;
                    END IF;
                END LOOP;
            END IF;

            IF details_value ? 'depositAmount'
               AND jsonb_typeof(details_value -> 'depositAmount')
                   NOT IN ('null', 'number') THEN
                RETURN false;
            END IF;
            IF jsonb_typeof(details_value -> 'depositAmount') = 'number'
               AND (details_value ->> 'depositAmount')::numeric
                   <> trunc((details_value ->> 'depositAmount')::numeric) THEN
                RETURN false;
            END IF;
        END IF;
    END LOOP;

    RETURN true;
END
$$
"""


_CREATE_ITEM_VALIDATOR = """
CREATE FUNCTION vada_purchase_request_item_r1_is_valid(
    purchase_type_value text,
    price_evidence_value jsonb,
    details_value jsonb
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
STRICT
PARALLEL SAFE
AS $$
DECLARE
    evidence jsonb;
    nested_value jsonb;
    field_name text;
    evidence_type text;
    has_general_evidence boolean := false;
    has_vendor_quote boolean := false;
BEGIN
    IF purchase_type_value NOT IN (
        'general', 'manufacturing_printing', 'rental', 'service'
    ) THEN
        RETURN false;
    END IF;
    IF jsonb_typeof(price_evidence_value) <> 'array'
       OR jsonb_array_length(price_evidence_value) < 1 THEN
        RETURN false;
    END IF;

    FOR evidence IN SELECT value FROM jsonb_array_elements(price_evidence_value) LOOP
        IF jsonb_typeof(evidence) <> 'object'
           OR jsonb_typeof(evidence -> 'type') <> 'string' THEN
            RETURN false;
        END IF;
        evidence_type := evidence ->> 'type';

        IF evidence_type = 'product_url' THEN
            IF NOT vada_jsonb_object_has_only_keys_r1(evidence, ARRAY['type', 'url'])
               OR jsonb_typeof(evidence -> 'url') <> 'string'
               OR char_length(evidence ->> 'url') < 1 THEN
                RETURN false;
            END IF;
            has_general_evidence := true;
        ELSIF evidence_type = 'vendor' THEN
            IF NOT vada_jsonb_object_has_only_keys_r1(
                evidence,
                ARRAY['type', 'vendorName']
            )
               OR jsonb_typeof(evidence -> 'vendorName') <> 'string'
               OR char_length(evidence ->> 'vendorName') < 1 THEN
                RETURN false;
            END IF;
            has_general_evidence := true;
        ELSIF evidence_type = 'price_screenshot' THEN
            IF NOT vada_jsonb_object_has_only_keys_r1(
                evidence,
                ARRAY['type', 'fileRef']
            )
               OR jsonb_typeof(evidence -> 'fileRef') <> 'string'
               OR char_length(evidence ->> 'fileRef') < 1 THEN
                RETURN false;
            END IF;
            has_general_evidence := true;
        ELSIF evidence_type = 'vendor_quote' THEN
            IF NOT vada_jsonb_object_has_only_keys_r1(
                evidence,
                ARRAY['type', 'fileRef', 'note']
            )
               OR NOT (evidence ? 'fileRef' OR evidence ? 'note') THEN
                RETURN false;
            END IF;
            FOREACH field_name IN ARRAY ARRAY['fileRef', 'note'] LOOP
                IF evidence ? field_name
                   AND (
                       jsonb_typeof(evidence -> field_name) <> 'string'
                       OR char_length(evidence ->> field_name) < 1
                   ) THEN
                    RETURN false;
                END IF;
            END LOOP;
            has_vendor_quote := true;
        ELSE
            RETURN false;
        END IF;
    END LOOP;

    IF purchase_type_value = 'general' AND NOT has_general_evidence THEN
        RETURN false;
    END IF;
    IF purchase_type_value <> 'general' AND NOT has_vendor_quote THEN
        RETURN false;
    END IF;
    IF jsonb_typeof(details_value) <> 'object' THEN
        RETURN false;
    END IF;

    IF purchase_type_value = 'general' THEN
        IF NOT vada_jsonb_object_has_only_keys_r1(
            details_value,
            ARRAY['vendor', 'productUrl', 'options', 'deliveryRequest']
        ) THEN
            RETURN false;
        END IF;
        FOREACH field_name IN ARRAY ARRAY[
            'vendor', 'productUrl', 'options', 'deliveryRequest'
        ] LOOP
            IF details_value ? field_name
               AND (
                   jsonb_typeof(details_value -> field_name) <> 'string'
                   OR char_length(details_value ->> field_name) < 1
               ) THEN
                RETURN false;
            END IF;
        END LOOP;
    ELSIF purchase_type_value = 'manufacturing_printing' THEN
        IF NOT vada_jsonb_object_has_only_keys_r1(
            details_value,
            ARRAY[
                'itemKind', 'specification', 'color', 'optionQuantities',
                'printMethod', 'deliveryDate', 'fileRefs', 'requestNote'
            ]
        ) THEN
            RETURN false;
        END IF;
        FOREACH field_name IN ARRAY ARRAY[
            'itemKind', 'specification', 'color', 'printMethod',
            'deliveryDate', 'requestNote'
        ] LOOP
            IF details_value ? field_name
               AND (
                   jsonb_typeof(details_value -> field_name) <> 'string'
                   OR char_length(details_value ->> field_name) < 1
               ) THEN
                RETURN false;
            END IF;
        END LOOP;
        IF details_value ? 'deliveryDate'
           AND details_value ->> 'deliveryDate' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
            RETURN false;
        END IF;
        IF details_value ? 'optionQuantities' THEN
            IF jsonb_typeof(details_value -> 'optionQuantities') <> 'object'
               OR NOT EXISTS (
                   SELECT 1 FROM jsonb_each(details_value -> 'optionQuantities')
               ) THEN
                RETURN false;
            END IF;
            FOR nested_value IN
                SELECT value FROM jsonb_each(details_value -> 'optionQuantities')
            LOOP
                IF jsonb_typeof(nested_value) <> 'number'
                   OR (nested_value #>> '{}')::numeric <= 0 THEN
                    RETURN false;
                END IF;
            END LOOP;
        END IF;
        IF details_value ? 'fileRefs' THEN
            IF jsonb_typeof(details_value -> 'fileRefs') <> 'array' THEN
                RETURN false;
            END IF;
            FOR nested_value IN
                SELECT value FROM jsonb_array_elements(details_value -> 'fileRefs')
            LOOP
                IF jsonb_typeof(nested_value) <> 'string'
                   OR char_length(nested_value #>> '{}') < 1 THEN
                    RETURN false;
                END IF;
            END LOOP;
        END IF;
    ELSIF purchase_type_value = 'rental' THEN
        IF NOT vada_jsonb_object_has_only_keys_r1(
            details_value,
            ARRAY[
                'vendor', 'pickupLocation', 'startDate', 'endDate', 'contact',
                'depositAmount', 'conditions'
            ]
        ) THEN
            RETURN false;
        END IF;
        FOREACH field_name IN ARRAY ARRAY[
            'vendor', 'pickupLocation', 'startDate', 'endDate', 'contact', 'conditions'
        ] LOOP
            IF details_value ? field_name
               AND (
                   jsonb_typeof(details_value -> field_name) <> 'string'
                   OR char_length(details_value ->> field_name) < 1
               ) THEN
                RETURN false;
            END IF;
        END LOOP;
        FOREACH field_name IN ARRAY ARRAY['startDate', 'endDate'] LOOP
            IF details_value ? field_name
               AND details_value ->> field_name !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
                RETURN false;
            END IF;
        END LOOP;
        IF details_value ? 'depositAmount'
           AND (
               jsonb_typeof(details_value -> 'depositAmount') <> 'number'
               OR (details_value ->> 'depositAmount')::numeric < 0
               OR (details_value ->> 'depositAmount')::numeric
                  <> trunc((details_value ->> 'depositAmount')::numeric)
           ) THEN
            RETURN false;
        END IF;
    ELSE
        IF NOT vada_jsonb_object_has_only_keys_r1(
            details_value,
            ARRAY[
                'provider', 'location', 'startDate', 'endDate', 'contact',
                'scope', 'requestNote'
            ]
        ) THEN
            RETURN false;
        END IF;
        FOREACH field_name IN ARRAY ARRAY[
            'provider', 'location', 'startDate', 'endDate',
            'contact', 'scope', 'requestNote'
        ] LOOP
            IF details_value ? field_name
               AND (
                   jsonb_typeof(details_value -> field_name) <> 'string'
                   OR char_length(details_value ->> field_name) < 1
               ) THEN
                RETURN false;
            END IF;
        END LOOP;
        FOREACH field_name IN ARRAY ARRAY['startDate', 'endDate'] LOOP
            IF details_value ? field_name
               AND details_value ->> field_name !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
                RETURN false;
            END IF;
        END LOOP;
    END IF;

    RETURN true;
END
$$
"""


_CREATE_AGGREGATE_GUARD = """
CREATE FUNCTION vada_purchase_request_r1_assert_item_aggregate()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    scope_organization_id text;
    scope_event_id text;
    scope_request_id text;
    expected_total numeric;
    actual_total numeric;
    item_count bigint;
BEGIN
    IF TG_TABLE_NAME = 'purchase_requests' THEN
        scope_organization_id := NEW.organization_id;
        scope_event_id := NEW.event_id;
        scope_request_id := NEW.request_id;
    ELSIF TG_OP = 'DELETE' THEN
        scope_organization_id := OLD.organization_id;
        scope_event_id := OLD.event_id;
        scope_request_id := OLD.request_id;
    ELSE
        scope_organization_id := NEW.organization_id;
        scope_event_id := NEW.event_id;
        scope_request_id := NEW.request_id;
    END IF;

    SELECT estimated_total
    INTO expected_total
    FROM purchase_requests
    WHERE organization_id = scope_organization_id
      AND event_id = scope_event_id
      AND request_id = scope_request_id;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    SELECT count(*), COALESCE(sum(estimated_amount), 0)
    INTO item_count, actual_total
    FROM purchase_request_items
    WHERE organization_id = scope_organization_id
      AND event_id = scope_event_id
      AND request_id = scope_request_id;

    IF item_count < 1 OR actual_total <> expected_total THEN
        RAISE EXCEPTION
            USING
                ERRCODE = '23514',
                CONSTRAINT = 'ck_purchase_requests_item_aggregate',
                MESSAGE = 'purchase request requires items whose amount sums '
                          'to estimated_total';
    END IF;

    RETURN NULL;
END
$$
"""


def upgrade() -> None:
    op.execute(_CREATE_JSONB_KEYS_FUNCTION)
    op.execute(_CREATE_DRAFT_VALIDATOR)
    op.execute(_CREATE_ITEM_VALIDATOR)

    op.create_table(
        "purchase_request_drafts",
        sa.Column("draft_id", sa.Text(), nullable=False),
        sa.Column("organization_id", sa.Text(), nullable=False),
        sa.Column("event_id", sa.Text(), nullable=False),
        sa.Column("owner_user_id", sa.Text(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("content", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "saved_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "char_length(draft_id) > 0",
            name=op.f("ck_purchase_request_drafts_draft_id_non_empty"),
        ),
        sa.CheckConstraint(
            "char_length(organization_id) > 0",
            name=op.f("ck_purchase_request_drafts_organization_id_non_empty"),
        ),
        sa.CheckConstraint(
            "char_length(event_id) > 0",
            name=op.f("ck_purchase_request_drafts_event_id_non_empty"),
        ),
        sa.CheckConstraint(
            "char_length(owner_user_id) > 0",
            name=op.f("ck_purchase_request_drafts_owner_user_id_non_empty"),
        ),
        sa.CheckConstraint(
            "version >= 1",
            name=op.f("ck_purchase_request_drafts_version_positive"),
        ),
        sa.CheckConstraint(
            "vada_purchase_request_draft_content_r1_is_valid(content)",
            name=op.f("ck_purchase_request_drafts_content_v1"),
        ),
        sa.PrimaryKeyConstraint("draft_id", name="pk_purchase_request_drafts"),
        sa.UniqueConstraint(
            "organization_id",
            "event_id",
            "owner_user_id",
            name="uq_purchase_request_drafts_scope",
        ),
    )

    op.create_table(
        "purchase_requests",
        sa.Column("request_id", sa.Text(), nullable=False),
        sa.Column("organization_id", sa.Text(), nullable=False),
        sa.Column("event_id", sa.Text(), nullable=False),
        sa.Column("requester_user_id", sa.Text(), nullable=False),
        sa.Column("request_department_id", sa.Text(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("needed_date", sa.Date(), nullable=False),
        sa.Column("purpose", sa.Text(), nullable=False),
        sa.Column("priority", sa.Text(), nullable=False),
        sa.Column(
            "status",
            sa.Text(),
            server_default=sa.text("'review_pending'"),
            nullable=False,
        ),
        sa.Column("estimated_total", sa.Numeric(), nullable=False),
        sa.Column("over_budget", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "char_length(request_id) > 0",
            name=op.f("ck_purchase_requests_request_id_non_empty"),
        ),
        sa.CheckConstraint(
            "char_length(organization_id) > 0",
            name=op.f("ck_purchase_requests_organization_id_non_empty"),
        ),
        sa.CheckConstraint(
            "char_length(event_id) > 0",
            name=op.f("ck_purchase_requests_event_id_non_empty"),
        ),
        sa.CheckConstraint(
            "char_length(requester_user_id) > 0",
            name=op.f("ck_purchase_requests_requester_user_id_non_empty"),
        ),
        sa.CheckConstraint(
            "char_length(request_department_id) > 0",
            name=op.f("ck_purchase_requests_request_department_id_non_empty"),
        ),
        sa.CheckConstraint(
            "char_length(title) > 0",
            name=op.f("ck_purchase_requests_title_non_empty"),
        ),
        sa.CheckConstraint(
            "char_length(purpose) > 0",
            name=op.f("ck_purchase_requests_purpose_non_empty"),
        ),
        sa.CheckConstraint(
            "priority IN ('normal', 'urgent')",
            name=op.f("ck_purchase_requests_priority_allowed"),
        ),
        sa.CheckConstraint(
            "status = 'review_pending'",
            name=op.f("ck_purchase_requests_review_pending"),
        ),
        sa.CheckConstraint(
            "estimated_total > 0",
            name=op.f("ck_purchase_requests_estimated_total_positive"),
        ),
        sa.PrimaryKeyConstraint("request_id", name="pk_purchase_requests"),
        sa.UniqueConstraint(
            "organization_id",
            "event_id",
            "request_id",
            name="uq_purchase_requests_scope_identity",
        ),
    )
    op.create_index(
        "ix_purchase_requests_own_recent",
        "purchase_requests",
        [
            "organization_id",
            "event_id",
            "requester_user_id",
            sa.text("created_at DESC"),
        ],
        unique=False,
    )

    op.create_table(
        "purchase_request_items",
        sa.Column("item_id", sa.Text(), nullable=False),
        sa.Column("organization_id", sa.Text(), nullable=False),
        sa.Column("event_id", sa.Text(), nullable=False),
        sa.Column("request_id", sa.Text(), nullable=False),
        sa.Column("item_position", sa.Integer(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("category", sa.Text(), nullable=False),
        sa.Column("budget_item", sa.Text(), nullable=False),
        sa.Column("purchase_type", sa.Text(), nullable=False),
        sa.Column("quantity", sa.Numeric(), nullable=False),
        sa.Column("unit", sa.Text(), nullable=False),
        sa.Column("estimated_unit_price", sa.Numeric(), nullable=False),
        sa.Column(
            "estimated_amount",
            sa.Numeric(),
            sa.Computed("quantity * estimated_unit_price", persisted=True),
            nullable=False,
        ),
        sa.Column(
            "price_evidence",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column("details", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.CheckConstraint(
            "char_length(item_id) > 0",
            name=op.f("ck_purchase_request_items_item_id_non_empty"),
        ),
        sa.CheckConstraint(
            "char_length(organization_id) > 0",
            name=op.f("ck_purchase_request_items_organization_id_non_empty"),
        ),
        sa.CheckConstraint(
            "char_length(event_id) > 0",
            name=op.f("ck_purchase_request_items_event_id_non_empty"),
        ),
        sa.CheckConstraint(
            "char_length(request_id) > 0",
            name=op.f("ck_purchase_request_items_request_id_non_empty"),
        ),
        sa.CheckConstraint(
            "char_length(name) > 0",
            name=op.f("ck_purchase_request_items_name_non_empty"),
        ),
        sa.CheckConstraint(
            "char_length(category) > 0",
            name=op.f("ck_purchase_request_items_category_non_empty"),
        ),
        sa.CheckConstraint(
            "char_length(budget_item) > 0",
            name=op.f("ck_purchase_request_items_budget_item_non_empty"),
        ),
        sa.CheckConstraint(
            "char_length(unit) > 0",
            name=op.f("ck_purchase_request_items_unit_non_empty"),
        ),
        sa.CheckConstraint(
            "item_position >= 0",
            name=op.f("ck_purchase_request_items_position_non_negative"),
        ),
        sa.CheckConstraint(
            "purchase_type IN ("
            "'general', 'manufacturing_printing', 'rental', 'service'"
            ")",
            name=op.f("ck_purchase_request_items_purchase_type_allowed"),
        ),
        sa.CheckConstraint(
            "quantity > 0",
            name=op.f("ck_purchase_request_items_quantity_positive"),
        ),
        sa.CheckConstraint(
            "estimated_unit_price > 0 "
            "AND estimated_unit_price = trunc(estimated_unit_price)",
            name=op.f("ck_purchase_request_items_unit_price_positive_integer"),
        ),
        sa.CheckConstraint(
            "vada_purchase_request_item_r1_is_valid("
            "purchase_type, price_evidence, details)",
            name=op.f("ck_purchase_request_items_contract_v1"),
        ),
        sa.ForeignKeyConstraint(
            ["organization_id", "event_id", "request_id"],
            [
                "purchase_requests.organization_id",
                "purchase_requests.event_id",
                "purchase_requests.request_id",
            ],
            name="fk_purchase_request_items_request_scope",
            ondelete="CASCADE",
            onupdate="CASCADE",
        ),
        sa.PrimaryKeyConstraint("item_id", name="pk_purchase_request_items"),
        sa.UniqueConstraint(
            "organization_id",
            "event_id",
            "request_id",
            "item_position",
            name="uq_purchase_request_items_position",
        ),
    )
    op.create_index(
        "ix_purchase_request_items_request_scope",
        "purchase_request_items",
        ["organization_id", "event_id", "request_id"],
        unique=False,
    )

    op.execute(_CREATE_AGGREGATE_GUARD)
    op.execute(
        """
        CREATE CONSTRAINT TRIGGER purchase_requests_require_matching_items
        AFTER INSERT OR UPDATE ON purchase_requests
        DEFERRABLE INITIALLY DEFERRED
        FOR EACH ROW
        EXECUTE FUNCTION vada_purchase_request_r1_assert_item_aggregate()
        """
    )
    op.execute(
        """
        CREATE CONSTRAINT TRIGGER purchase_request_items_preserve_request_aggregate
        AFTER INSERT OR UPDATE OR DELETE ON purchase_request_items
        DEFERRABLE INITIALLY DEFERRED
        FOR EACH ROW
        EXECUTE FUNCTION vada_purchase_request_r1_assert_item_aggregate()
        """
    )


def downgrade() -> None:
    op.execute(
        "DROP TRIGGER purchase_request_items_preserve_request_aggregate "
        "ON purchase_request_items"
    )
    op.execute(
        "DROP TRIGGER purchase_requests_require_matching_items ON purchase_requests"
    )
    op.execute("DROP FUNCTION vada_purchase_request_r1_assert_item_aggregate()")
    op.drop_index(
        "ix_purchase_request_items_request_scope",
        table_name="purchase_request_items",
    )
    op.drop_table("purchase_request_items")
    op.drop_index("ix_purchase_requests_own_recent", table_name="purchase_requests")
    op.drop_table("purchase_requests")
    op.drop_table("purchase_request_drafts")
    op.execute(
        "DROP FUNCTION vada_purchase_request_item_r1_is_valid(text, jsonb, jsonb)"
    )
    op.execute("DROP FUNCTION vada_purchase_request_draft_content_r1_is_valid(jsonb)")
    op.execute("DROP FUNCTION vada_jsonb_object_has_only_keys_r1(jsonb, text[])")
