from __future__ import annotations

from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from vada_api.database import (
    DATABASE_URL_ENVIRONMENT_VARIABLE,
    resolve_database_url,
)
from vada_api.finance.persistence.schema import metadata as finance_metadata
from vada_api.identity.persistence.schema import metadata as identity_metadata

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

if finance_metadata is not identity_metadata:
    raise RuntimeError("Persistence modules must share one SQLAlchemy metadata object.")

target_metadata = finance_metadata


def run_migrations_offline() -> None:
    """PostgreSQL DDL을 연결 없이 렌더링한다."""
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        output_buffer=config.output_buffer,
        transactional_ddl=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def _resolve_target_url() -> None:
    """어디에 적용할지 정하고 그 결정을 config에 남긴다.

    alembic.ini에는 방언을 고르는 자리만 있고 주소가 없다. 여기서 정하지 않으면
    적용할 곳이 없다.
    """
    target = resolve_database_url(config.get_main_option("sqlalchemy.url"))
    if target is None:
        raise SystemExit(
            f"{DATABASE_URL_ENVIRONMENT_VARIABLE}이 없습니다."
            " 적용할 데이터베이스 주소를 넣고 다시 실행하세요."
        )

    # configparser가 %를 보간 문자로 읽는다. 비밀번호에 들어 있으면 깨진다.
    config.set_main_option("sqlalchemy.url", target.replace("%", "%%"))


def run_migrations_online() -> None:
    """명시적으로 지정한 PostgreSQL에 마이그레이션을 적용한다."""
    _resolve_target_url()

    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            transactional_ddl=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
