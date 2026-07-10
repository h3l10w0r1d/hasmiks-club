"""
Deep analytics endpoint for the admin dashboard.
Returns everything the frontend needs in a single call.
"""
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core import ameriabank
from app.core.deps import require_permission
from app.database import get_db
from app.models.ameria_payment import AmeriaPayment
from app.models.content import ContentItem, MemberContent
from app.models.event import Event
from app.models.guest_ticket import GuestTicket
from app.models.rsvp import RSVP
from app.models.user import User

FAILED_STATUSES = {"declined", "void", "error"}

router = APIRouter(prefix="/admin/analytics", tags=["analytics"])


# ── helpers ───────────────────────────────────────────────────────────────────


def _month_range(year: int, month: int):
    """Return (first_day, last_day_exclusive) for a given year+month."""
    start = datetime(year, month, 1, tzinfo=timezone.utc)
    if month == 12:
        end = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        end = datetime(year, month + 1, 1, tzinfo=timezone.utc)
    return start, end


def _last_n_months(n: int):
    now = datetime.now(timezone.utc)
    months = []
    for i in range(n - 1, -1, -1):
        total_months = now.month - 1 - i
        year = now.year + total_months // 12
        month = total_months % 12 + 1
        months.append((year, month))
    return months


def _amt(v) -> float:
    """Numeric(12,2) comes back as Decimal — normalize to plain float for JSON."""
    return float(v or 0)


def _compute_financials(db: Session, now: datetime) -> dict:
    """Revenue across both money-taking flows — membership payments and
    one-time guest event tickets — kept separate per row but combined for
    every headline number, since both are real revenue regardless of which
    table tracks them."""
    memberships = db.query(AmeriaPayment).all()
    guest_tickets = db.query(GuestTicket).all()

    def is_paid(status): return status in ameriabank.PAID_STATUSES
    def is_failed(status): return status in FAILED_STATUSES

    paid_memberships = [p for p in memberships if is_paid(p.status)]
    paid_guests = [g for g in guest_tickets if is_paid(g.status)]
    failed_memberships = [p for p in memberships if is_failed(p.status)]
    failed_guests = [g for g in guest_tickets if is_failed(g.status)]
    refunded_memberships = [p for p in memberships if p.status == "refunded"]
    refunded_guests = [g for g in guest_tickets if g.status == "refunded"]

    membership_revenue = sum(_amt(p.amount) for p in paid_memberships)
    guest_revenue = sum(_amt(g.amount) for g in paid_guests)
    total_revenue = membership_revenue + guest_revenue
    total_paid = len(paid_memberships) + len(paid_guests)
    total_failed = len(failed_memberships) + len(failed_guests)
    total_refunded = sum(_amt(p.amount) for p in refunded_memberships) + sum(_amt(g.amount) for g in refunded_guests)

    # month-over-month revenue growth
    month_start, month_end = _month_range(now.year, now.month)
    prev_month = now.month - 1 or 12
    prev_year = now.year if now.month > 1 else now.year - 1
    lm_start, lm_end = _month_range(prev_year, prev_month)

    def revenue_between(start, end):
        m = sum(_amt(p.amount) for p in paid_memberships if start <= p.created_at.replace(tzinfo=timezone.utc) < end)
        g = sum(_amt(g.amount) for g in paid_guests if start <= g.created_at.replace(tzinfo=timezone.utc) < end)
        return m + g

    revenue_this_month = revenue_between(month_start, month_end)
    revenue_last_month = revenue_between(lm_start, lm_end)
    revenue_mom_growth = (
        round((revenue_this_month - revenue_last_month) / revenue_last_month * 100, 1)
        if revenue_last_month > 0 else None
    )

    total_transactions = len(memberships) + len(guest_tickets)
    conversion_rate = round(total_paid / total_transactions * 100, 1) if total_transactions else 0

    overview = {
        "total_revenue": total_revenue,
        "membership_revenue": membership_revenue,
        "guest_ticket_revenue": guest_revenue,
        "revenue_this_month": revenue_this_month,
        "revenue_last_month": revenue_last_month,
        "revenue_mom_growth": revenue_mom_growth,
        "total_paid_transactions": total_paid,
        "avg_transaction_value": round(total_revenue / total_paid, 0) if total_paid else 0,
        "total_failed_transactions": total_failed,
        "conversion_rate": conversion_rate,
        "total_refunded": total_refunded,
    }

    # ── revenue trend — last 12 months, membership vs guest tickets ─────────
    revenue_trend = []
    cumulative = 0.0
    for year, month in _last_n_months(12):
        start, end = _month_range(year, month)
        m_rev = sum(_amt(p.amount) for p in paid_memberships if start <= p.created_at.replace(tzinfo=timezone.utc) < end)
        g_rev = sum(_amt(g.amount) for g in paid_guests if start <= g.created_at.replace(tzinfo=timezone.utc) < end)
        cumulative += m_rev + g_rev
        revenue_trend.append({
            "month": start.strftime("%b %Y"),
            "membership": round(m_rev),
            "guest_tickets": round(g_rev),
            "total": round(m_rev + g_rev),
            "cumulative": round(cumulative),
        })

    # ── payment status breakdown (funnel) ────────────────────────────────────
    status_counts: dict[str, dict] = {}
    for rows in (memberships, guest_tickets):
        for r in rows:
            bucket = status_counts.setdefault(r.status, {"status": r.status, "count": 0, "amount": 0.0})
            bucket["count"] += 1
            bucket["amount"] += _amt(r.amount)
    payment_status_breakdown = sorted(status_counts.values(), key=lambda x: x["amount"], reverse=True)

    # ── top paying members (lifetime value) ──────────────────────────────────
    member_totals: dict[int, float] = {}
    member_counts: dict[int, int] = {}
    for p in paid_memberships:
        member_totals[p.user_id] = member_totals.get(p.user_id, 0) + _amt(p.amount)
        member_counts[p.user_id] = member_counts.get(p.user_id, 0) + 1
    top_paying_members = []
    for user_id, total in sorted(member_totals.items(), key=lambda x: x[1], reverse=True)[:10]:
        u = db.query(User).filter(User.id == user_id).first()
        if u:
            top_paying_members.append({
                "id": u.id, "full_name": u.full_name, "email": u.email,
                "lifetime_value": total, "payment_count": member_counts[user_id],
            })

    # ── revenue by event (guest tickets only — membership isn't event-scoped) ─
    event_totals: dict[int, dict] = {}
    for g in paid_guests:
        bucket = event_totals.setdefault(g.event_id, {"event_id": g.event_id, "revenue": 0.0, "ticket_count": 0})
        bucket["revenue"] += _amt(g.amount)
        bucket["ticket_count"] += 1
    revenue_by_event = []
    for event_id, bucket in sorted(event_totals.items(), key=lambda x: x[1]["revenue"], reverse=True):
        e = db.query(Event).filter(Event.id == event_id).first()
        revenue_by_event.append({**bucket, "title": e.title if e else f"Event #{event_id}"})

    # ── recent transactions (both kinds, most recent first) ──────────────────
    recent_transactions = []
    for p in memberships:
        u = db.query(User).filter(User.id == p.user_id).first()
        recent_transactions.append({
            "id": f"m{p.id}", "type": "membership",
            "name": u.full_name if u else "Unknown", "email": u.email if u else None,
            "amount": _amt(p.amount), "status": p.status, "created_at": p.created_at.isoformat(),
        })
    for g in guest_tickets:
        recent_transactions.append({
            "id": f"g{g.id}", "type": "guest_ticket",
            "name": g.full_name, "email": g.email,
            "amount": _amt(g.amount), "status": g.status, "created_at": g.created_at.isoformat(),
        })
    recent_transactions.sort(key=lambda x: x["created_at"], reverse=True)

    failed_transactions = [
        t for t in recent_transactions if t["status"] in FAILED_STATUSES
    ][:15]

    return {
        "overview": overview,
        "revenue_trend": revenue_trend,
        "payment_status_breakdown": payment_status_breakdown,
        "top_paying_members": top_paying_members,
        "revenue_by_event": revenue_by_event,
        "recent_transactions": recent_transactions[:30],
        "failed_transactions": failed_transactions,
    }


# ── main endpoint ─────────────────────────────────────────────────────────────


@router.get("")
def get_analytics(
    db: Session = Depends(get_db),
    _: User = Depends(require_permission('view_analytics')),
) -> dict[str, Any]:

    now = datetime.now(timezone.utc)

    # ── overview counts ──────────────────────────────────────────────────────
    total_members = db.query(User).count()
    active_members = db.query(User).filter(User.membership_status == "active").count()
    inactive_members = db.query(User).filter(User.membership_status == "inactive").count()
    total_events = db.query(Event).count()
    past_events = db.query(Event).filter(Event.event_date < now).count()
    upcoming_events = db.query(Event).filter(Event.event_date >= now).count()
    total_rsvps = db.query(RSVP).count()
    total_content = db.query(ContentItem).count()
    total_unlocks = db.query(MemberContent).count()

    # This month new members
    month_start, _ = _month_range(now.year, now.month)
    new_this_month = db.query(User).filter(User.joined_at >= month_start).count()

    # Last month new members (for MoM growth calc)
    prev_month = now.month - 1 or 12
    prev_year = now.year if now.month > 1 else now.year - 1
    lm_start, lm_end = _month_range(prev_year, prev_month)
    new_last_month = db.query(User).filter(
        User.joined_at >= lm_start, User.joined_at < lm_end
    ).count()

    mom_growth = (
        round((new_this_month - new_last_month) / max(new_last_month, 1) * 100, 1)
        if new_last_month > 0 else None
    )

    activation_rate = round(active_members / total_members * 100, 1) if total_members else 0

    all_events = db.query(Event).all()
    avg_fill_rate = (
        round(sum(len(e.rsvps) / e.max_seats for e in all_events if e.max_seats) / len(all_events) * 100, 1)
        if all_events else 0
    )

    members_with_rsvp = db.query(RSVP.user_id).distinct().count()

    overview = {
        "total_members": total_members,
        "active_members": active_members,
        "inactive_members": inactive_members,
        "activation_rate": activation_rate,
        "new_this_month": new_this_month,
        "mom_growth": mom_growth,
        "total_events": total_events,
        "past_events": past_events,
        "upcoming_events": upcoming_events,
        "total_rsvps": total_rsvps,
        "avg_fill_rate": avg_fill_rate,
        "total_content": total_content,
        "total_unlocks": total_unlocks,
        "members_with_rsvp": members_with_rsvp,
        "engagement_rate": round(members_with_rsvp / total_members * 100, 1) if total_members else 0,
    }

    # ── member growth — last 12 months ───────────────────────────────────────
    months = _last_n_months(12)
    cumulative = db.query(User).filter(User.joined_at < _month_range(*months[0])[0]).count()
    member_growth = []
    for year, month in months:
        start, end = _month_range(year, month)
        new = db.query(User).filter(User.joined_at >= start, User.joined_at < end).count()
        cumulative += new
        member_growth.append({
            "month": start.strftime("%b %Y"),
            "new_members": new,
            "cumulative": cumulative,
        })

    # ── membership status breakdown by join cohort ───────────────────────────
    cohorts = []
    for year, month in _last_n_months(6):
        start, end = _month_range(year, month)
        cohort_users = db.query(User).filter(User.joined_at >= start, User.joined_at < end).all()
        if not cohort_users:
            continue
        active_c = sum(1 for u in cohort_users if u.membership_status == "active")
        cohorts.append({
            "month": start.strftime("%b %Y"),
            "total": len(cohort_users),
            "active": active_c,
            "inactive": len(cohort_users) - active_c,
            "activation_rate": round(active_c / len(cohort_users) * 100, 1),
        })

    # ── events performance ───────────────────────────────────────────────────
    events_data = []
    for e in sorted(all_events, key=lambda x: x.event_date, reverse=True):
        rsvp_count = len(e.rsvps)
        fill_rate = round(rsvp_count / e.max_seats * 100, 1) if e.max_seats else 0
        events_data.append({
            "id": e.id,
            "title": e.title,
            "event_date": e.event_date.isoformat(),
            "max_seats": e.max_seats,
            "rsvp_count": rsvp_count,
            "fill_rate": fill_rate,
            "is_past": e.event_date < now,
        })

    # ── rsvp trend — last 12 months ──────────────────────────────────────────
    rsvp_trend = []
    for year, month in _last_n_months(12):
        start, end = _month_range(year, month)
        count = db.query(RSVP).filter(RSVP.created_at >= start, RSVP.created_at < end).count()
        rsvp_trend.append({"month": start.strftime("%b %Y"), "rsvps": count})

    # ── content engagement ───────────────────────────────────────────────────
    content_rows = (
        db.query(
            ContentItem.id,
            ContentItem.title,
            ContentItem.type,
            ContentItem.published_at,
            func.count(MemberContent.id).label("unlock_count"),
        )
        .outerjoin(MemberContent, ContentItem.id == MemberContent.content_id)
        .group_by(ContentItem.id, ContentItem.title, ContentItem.type, ContentItem.published_at)
        .order_by(func.count(MemberContent.id).desc())
        .all()
    )
    content_engagement = [
        {
            "id": r.id,
            "title": r.title,
            "type": r.type,
            "published_at": r.published_at.isoformat() if r.published_at else None,
            "unlock_count": r.unlock_count,
        }
        for r in content_rows
    ]

    # ── member engagement scores ─────────────────────────────────────────────
    rsvp_counts = {
        r.user_id: r.rsvp_count
        for r in db.query(RSVP.user_id, func.count(RSVP.id).label("rsvp_count"))
        .group_by(RSVP.user_id)
        .all()
    }
    unlock_counts = {
        r.user_id: r.unlock_count
        for r in db.query(
            MemberContent.user_id, func.count(MemberContent.id).label("unlock_count")
        )
        .group_by(MemberContent.user_id)
        .all()
    }

    all_members = db.query(User).all()
    scored = []
    for u in all_members:
        rc = rsvp_counts.get(u.id, 0)
        uc = unlock_counts.get(u.id, 0)
        score = rc * 3 + uc * 2  # RSVPs weighted higher
        days_since_join = (now - u.joined_at.replace(tzinfo=timezone.utc)).days
        scored.append({
            "id": u.id,
            "full_name": u.full_name,
            "email": u.email,
            "membership_status": u.membership_status,
            "joined_at": u.joined_at.isoformat(),
            "days_since_join": days_since_join,
            "rsvp_count": rc,
            "unlock_count": uc,
            "score": score,
        })

    top_members = sorted(scored, key=lambda x: x["score"], reverse=True)[:10]

    # ── disengaged: joined 14+ days ago, zero RSVPs ──────────────────────────
    rsvpd_ids = set(rsvp_counts.keys())
    disengaged = [
        m for m in scored
        if m["id"] not in rsvpd_ids and m["days_since_join"] >= 14
    ]
    disengaged.sort(key=lambda x: x["days_since_join"], reverse=True)

    # ── at-risk: were active, haven't RSVPd in 60+ days ─────────────────────
    sixty_days_ago = now - timedelta(days=60)
    at_risk = []
    for u in db.query(User).filter(User.membership_status == "active").all():
        last_rsvp = (
            db.query(func.max(RSVP.created_at))
            .filter(RSVP.user_id == u.id)
            .scalar()
        )
        if last_rsvp is None or last_rsvp.replace(tzinfo=timezone.utc) < sixty_days_ago:
            days = (
                (now - last_rsvp.replace(tzinfo=timezone.utc)).days
                if last_rsvp else None
            )
            at_risk.append({
                "id": u.id,
                "full_name": u.full_name,
                "email": u.email,
                "last_rsvp_days_ago": days,
            })

    # ── recent activity feed (last 20 items) ─────────────────────────────────
    recent_rsvps = (
        db.query(RSVP)
        .order_by(RSVP.created_at.desc())
        .limit(10)
        .all()
    )
    recent_joins = (
        db.query(User)
        .order_by(User.joined_at.desc())
        .limit(5)
        .all()
    )
    recent_unlocks = (
        db.query(MemberContent)
        .order_by(MemberContent.unlocked_at.desc())
        .limit(5)
        .all()
    )

    activity: list[dict] = []
    for r in recent_rsvps:
        u = db.query(User).filter(User.id == r.user_id).first()
        e = db.query(Event).filter(Event.id == r.event_id).first()
        if u and e:
            activity.append({
                "type": "rsvp",
                "icon": "📅",
                "text": f"{u.full_name} RSVP'd to {e.title}",
                "at": r.created_at.isoformat(),
            })
    for u in recent_joins:
        activity.append({
            "type": "join",
            "icon": "👋",
            "text": f"{u.full_name} joined the club",
            "at": u.joined_at.isoformat(),
        })
    for mc in recent_unlocks:
        u = db.query(User).filter(User.id == mc.user_id).first()
        c = db.query(ContentItem).filter(ContentItem.id == mc.content_id).first()
        if u and c:
            activity.append({
                "type": "unlock",
                "icon": "📖",
                "text": f"{u.full_name} unlocked {c.title}",
                "at": mc.unlocked_at.isoformat(),
            })
    activity.sort(key=lambda x: x["at"], reverse=True)
    activity = activity[:20]

    # ── referral leaderboard ─────────────────────────────────────────────────
    from sqlalchemy.orm import aliased
    Referred = aliased(User)
    referral_rows = (
        db.query(User.id, User.full_name, func.count(Referred.id).label('cnt'))
        .join(Referred, Referred.referred_by_id == User.id)
        .group_by(User.id, User.full_name)
        .order_by(func.count(Referred.id).desc())
        .limit(10)
        .all()
    )
    referral_leaderboard = [
        {"id": r.id, "full_name": r.full_name, "referral_count": r.cnt}
        for r in referral_rows
    ]

    return {
        "overview": overview,
        "member_growth": member_growth,
        "cohorts": cohorts,
        "events": events_data,
        "rsvp_trend": rsvp_trend,
        "content_engagement": content_engagement,
        "top_members": top_members,
        "disengaged": disengaged,
        "at_risk": at_risk,
        "recent_activity": activity,
        "referral_leaderboard": referral_leaderboard,
        "financials": _compute_financials(db, now),
    }
