"""resolve existing Yandex Maps short-link map_urls to their coordinate URL

Revision ID: 0027
Revises: 0026
Create Date: 2026-07-21

Events saved before the map iframe embed shipped may hold a short share
link (yandex.*/maps/-/xxxx) with no ll/z coordinates in the query string,
so the iframe embed can't be built from them. This is a one-time data
backfill — resolve_map_url() follows the redirect to the coordinate-bearing
URL and we persist that instead. Best-effort: any row that fails to
resolve (Yandex unreachable, link already expired) is left untouched.
"""
from alembic import op
import sqlalchemy as sa

from app.core.yandex import resolve_map_url

revision = '0027'
down_revision = '0026'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    rows = conn.execute(sa.text(
        "SELECT id, map_url FROM events WHERE map_url IS NOT NULL AND map_url LIKE '%yandex.%' AND map_url NOT LIKE '%ll=%'"
    )).fetchall()
    for row in rows:
        resolved = resolve_map_url(row.map_url)
        if resolved and resolved != row.map_url:
            conn.execute(
                sa.text("UPDATE events SET map_url = :url WHERE id = :id"),
                {"url": resolved, "id": row.id},
            )


def downgrade():
    pass
