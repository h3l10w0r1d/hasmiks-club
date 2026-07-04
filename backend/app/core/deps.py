import json
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.security import decode_token
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

ALL_PERMISSIONS = [
    'manage_members', 'manage_events', 'manage_content', 'manage_gallery',
    'manage_applications', 'manage_settings', 'broadcast', 'view_analytics',
    'view_audit', 'manage_roles', 'manage_payments',
]

ROLE_PERMISSIONS: dict[str, list[str]] = {
    'admin':     ALL_PERMISSIONS,
    'moderator': ['manage_events', 'manage_content', 'manage_gallery',
                  'manage_applications', 'view_analytics'],
    'member':    [],
}


def get_user_permissions(user: User) -> list[str]:
    """Returns the effective permission list for a user."""
    if user.permissions:
        try:
            return json.loads(user.permissions)
        except Exception:
            pass
    return ROLE_PERMISSIONS.get(user.role, [])


def has_permission(user: User, perm: str) -> bool:
    return perm in get_user_permissions(user)


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    user_id = decode_token(token)
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def get_current_active_member(user: User = Depends(get_current_user)) -> User:
    if user.membership_status != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Active membership required")
    return user


def get_current_admin(user: User = Depends(get_current_user)) -> User:
    """Allows access to admin panel if user has any admin-level permission or is role admin/moderator."""
    if user.role not in ('admin', 'moderator') and not user.is_admin and not get_user_permissions(user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    # Still enforce: must have at least one permission OR be admin/moderator role
    if user.role == 'member' and not get_user_permissions(user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user


def require_permission(perm: str):
    """Dependency factory — raises 403 if user lacks the specific permission."""
    def dep(user: User = Depends(get_current_user)) -> User:
        if not has_permission(user, perm):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission required: {perm}"
            )
        return user
    return dep
