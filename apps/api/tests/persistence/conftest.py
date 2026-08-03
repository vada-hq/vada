from __future__ import annotations

import os
import shutil
from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from docker.errors import DockerException
from sqlalchemy import Engine, create_engine, inspect
from testcontainers.community.postgres import PostgresContainer

API_ROOT = Path(__file__).parents[2]


def alembic_config(database_url: str | None = None) -> Config:
    config = Config(str(API_ROOT / "alembic.ini"))
    if database_url is not None:
        config.set_main_option("sqlalchemy.url", database_url.replace("%", "%%"))
    return config


@pytest.fixture(scope="session")
def postgres_url() -> Iterator[str]:
    explicit_url = os.getenv("VADA_TEST_DATABASE_URL")
    if explicit_url:
        yield explicit_url
        return

    if shutil.which("docker") is None:
        pytest.skip(
            "PostgreSQL integration blocked: set VADA_TEST_DATABASE_URL to a "
            "disposable empty database or install Docker with a running daemon."
        )

    try:
        with PostgresContainer("postgres:17-alpine", driver="psycopg") as postgres:
            yield postgres.get_connection_url()
    except DockerException as error:
        pytest.skip(f"PostgreSQL integration blocked by Docker: {error}")


@pytest.fixture(scope="session")
def migrated_engine(postgres_url: str) -> Iterator[Engine]:
    engine = create_engine(postgres_url)
    existing_tables = set(inspect(engine).get_table_names())
    assert not existing_tables, (
        "VADA_TEST_DATABASE_URL must point to a disposable empty PostgreSQL database; "
        f"found {sorted(existing_tables)}"
    )

    command.upgrade(alembic_config(postgres_url), "head")
    try:
        yield engine
    finally:
        engine.dispose()
