import asyncio
import re
from typing import Annotated
from fastapi import Depends, Header, HTTPException, status
from app.core.database import get_pool
from app.core.supabase import get_supabase_anon
from app.models.municipality_user import MunicipalityUserRecord

_BEARER = re.compile(r"^Bearer\s+(.+)$", re.I)


def _parse_bearer(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
        )
    m = _BEARER.match(authorization.strip())
    if not m:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Authorization header",
        )
    return m.group(1).strip()


async def get_current_user(
    authorization: Annotated[str | None, Header(alias="Authorization")] = None,
) -> MunicipalityUserRecord:
    token = _parse_bearer(authorization)
    anon = get_supabase_anon()

    def _get_user():
        return anon.auth.get_user(token)

    try:
        res = await asyncio.to_thread(_get_user)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from None
    user = getattr(res, "user", None)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    uid = getattr(user, "id", None)
    if not uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT id, email, first_name, last_name, phone_number, semel_yish,
                   department, role, is_active, last_login_at, created_at, updated_at
            FROM municipality_users
            WHERE id = $1
            """,
            uid,
        )
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User profile not found",
        )
    if not row["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is inactive",
        )
    return MunicipalityUserRecord(
        id=row["id"],
        email=row["email"],
        first_name=row["first_name"],
        last_name=row["last_name"],
        phone_number=row["phone_number"],
        semel_yish=row["semel_yish"],
        department=row["department"],
        role=row["role"],
        is_active=row["is_active"],
        last_login_at=row["last_login_at"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def require_admin(
    user: Annotated[MunicipalityUserRecord, Depends(get_current_user)],
) -> MunicipalityUserRecord:
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role required",
        )
    return user


def require_editor(
    user: Annotated[MunicipalityUserRecord, Depends(get_current_user)],
) -> MunicipalityUserRecord:
    if user.role not in ("admin", "editor"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Editor or admin role required",
        )
    return user
