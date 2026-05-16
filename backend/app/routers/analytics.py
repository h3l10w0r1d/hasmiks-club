"""
Deep analytics endpoint for the admin dashboard.
Returns everything the frontend needs in a single call.
"""
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.deps import get_current_admin
from app.database import get_db
from app.models.content import ContentItem, MemberContent
from app.models.event import Event
from app.models.rsvp import RSVP
from app.models.user import User

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


# ── main endpoint ─────────────────────────────────────────────────────────────


@router.get("")
def get_analytics(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
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
    }
