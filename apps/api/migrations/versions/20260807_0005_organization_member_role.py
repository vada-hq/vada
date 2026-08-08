"""조직 구성원의 기본 역할을 저장할 자리를 만든다.

Revision ID: 20260807_0005
Revises: 20260807_0004
Create Date: 2026-08-07
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260807_0005"
down_revision: str | None = "20260807_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

phase: str = "expand"

TABLE = "organization_memberships"
COLUMN = "role"

# VADA_PERMISSION_MATRIX.md의 기본 직급 셋. 재정부는 여기 없다. 재정부는 직급이
# 아니라 부서 조건이므로 department_memberships가 답한다.
ROLES = ("president", "department_head", "member")


def upgrade() -> None:
    # 기존 행에 값을 채우기 위해 기본값을 두고 추가한다. 확장 단계에서 열을 늘리는
    # 것만 하고 기존 코드가 모르는 열은 그대로 두어도 동작한다.
    op.add_column(
        TABLE,
        sa.Column(
            COLUMN,
            sa.Text(),
            nullable=False,
            server_default="member",
        ),
    )
    op.create_check_constraint(
        op.f(f"ck_{TABLE}_{COLUMN}_known"),
        TABLE,
        sa.column(COLUMN).in_(ROLES),
    )
    # 회장단 목록은 이 열만 보고 뽑는다. 조직 안에서 역할로 거르는 질의가
    # 마지막 회장단 보호와 세션 판정 양쪽에서 쓰인다.
    op.create_index(
        op.f(f"ix_{TABLE}_organization_id_{COLUMN}"),
        TABLE,
        ["organization_id", COLUMN],
    )


def downgrade() -> None:
    op.drop_index(op.f(f"ix_{TABLE}_organization_id_{COLUMN}"), table_name=TABLE)
    op.drop_constraint(op.f(f"ck_{TABLE}_{COLUMN}_known"), TABLE, type_="check")
    op.drop_column(TABLE, COLUMN)
