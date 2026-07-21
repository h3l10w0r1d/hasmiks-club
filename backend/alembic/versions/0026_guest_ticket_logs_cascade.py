"""cascade-delete guest_ticket_logs when their guest_ticket is deleted

Revision ID: 0026
Revises: 0025
Create Date: 2026-07-21

The FK was created with no ON DELETE clause (defaults to RESTRICT), so
deleting an event whose guest tickets still had log rows failed with a
ForeignKeyViolation — Event.guest_tickets cascades to delete GuestTicket
rows, but the DB then refused because GuestTicketLog rows still pointed at
them.
"""
from alembic import op

revision = '0026'
down_revision = '0025'
branch_labels = None
depends_on = None


def upgrade():
    op.drop_constraint('guest_ticket_logs_ticket_row_id_fkey', 'guest_ticket_logs', type_='foreignkey')
    op.create_foreign_key(
        'guest_ticket_logs_ticket_row_id_fkey', 'guest_ticket_logs', 'guest_tickets',
        ['ticket_row_id'], ['id'], ondelete='CASCADE',
    )


def downgrade():
    op.drop_constraint('guest_ticket_logs_ticket_row_id_fkey', 'guest_ticket_logs', type_='foreignkey')
    op.create_foreign_key(
        'guest_ticket_logs_ticket_row_id_fkey', 'guest_ticket_logs', 'guest_tickets',
        ['ticket_row_id'], ['id'],
    )
