"""Existing token hashes survive upgrade and repeated startup migrations."""

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from backend.app.core.database import _migrate_saved_overlay_tokens


@pytest.mark.asyncio
async def test_legacy_hash_survives_idempotent_migration():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    try:
        async with engine.begin() as conn:
            await conn.execute(text("CREATE TABLE long_lived_tokens (id INTEGER PRIMARY KEY, secret_hash TEXT)"))
            await conn.execute(text("INSERT INTO long_lived_tokens VALUES (1, 'existing-hash')"))
            await _migrate_saved_overlay_tokens(conn)
            row = (await conn.execute(text("SELECT secret_hash, encrypted_token FROM long_lived_tokens"))).one()
            assert row == ("existing-hash", None)
            await conn.execute(text("UPDATE long_lived_tokens SET encrypted_token = 'encrypted-copy'"))
            await _migrate_saved_overlay_tokens(conn)
            row = (await conn.execute(text("SELECT secret_hash, encrypted_token FROM long_lived_tokens"))).one()
            assert row == ("existing-hash", "encrypted-copy")
    finally:
        await engine.dispose()
