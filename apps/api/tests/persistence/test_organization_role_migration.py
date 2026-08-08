from __future__ import annotations

from functools import cache
from io import StringIO
from pathlib import Path

from alembic import command
from alembic.config import Config
from pglast import parse_sql

API_ROOT = Path(__file__).parents[2]

# PostgreSQL 식별자 한도. 넘으면 조용히 잘려 다른 이름과 부딪힌다.
IDENTIFIER_LIMIT = 63


@cache
def _render_upgrade_ddl() -> str:
    output = StringIO()
    config = Config(str(API_ROOT / "alembic.ini"))
    config.output_buffer = output
    command.upgrade(config, "head", sql=True)
    return output.getvalue()


def test_expand_migration_adds_organization_member_role() -> None:
    ddl = _render_upgrade_ddl()
    parse_sql(ddl)

    assert "ALTER TABLE organization_memberships ADD COLUMN role TEXT" in ddl
    assert "DEFAULT 'member'" in ddl
    assert "ck_organization_memberships_role_known" in ddl
    assert "ix_organization_memberships_organization_id_role" in ddl


def test_role_check_constraint_lists_exactly_the_three_base_ranks() -> None:
    ddl = _render_upgrade_ddl()

    # 기본 직급은 회장단·부서장·부원 셋뿐이다. 재정부는 직급이 아니라 부서 조건이라
    # 여기 들어오면 안 된다. VADA_PERMISSION_MATRIX.md의 역할 축이 기준이다.
    for role in ("president", "department_head", "member"):
        assert f"'{role}'" in ddl

    constraint = ddl.split("ck_organization_memberships_role_known")[1][:200]
    assert "finance" not in constraint.lower()


def test_every_constraint_name_fits_postgresql_identifier_limit() -> None:
    ddl = _render_upgrade_ddl()

    prefixes = ("ck_", "ix_", "uq_", "fk_", "pk_")
    for line in ddl.splitlines():
        for raw in line.replace("(", " ").replace(")", " ").replace(",", " ").split():
            name = raw.strip('"')
            if name.startswith(prefixes):
                assert len(name) <= IDENTIFIER_LIMIT, name
