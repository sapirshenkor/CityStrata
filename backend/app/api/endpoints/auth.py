import asyncio
import json
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from supabase_auth.errors import AuthApiError
from app.core.database import get_pool
from app.core.supabase import get_supabase_anon, get_supabase_service
from app.core.auth import get_current_user
from app.models.municipality_user import (
    LoginRequest,
    LoginResponse,
    MunicipalityUserRecord,
    SignupRequest,
    UpdateUserRequest,
    UserResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _row_to_user_response(row) -> UserResponse:
    return UserResponse(
        id=row["id"],
        email=row["email"],
        first_name=row["first_name"],
        last_name=row["last_name"],
        phone_number=row.get("phone_number"),
        semel_yish=row["semel_yish"],
        department=row["department"],
        role=row["role"],
        is_active=row["is_active"],
        created_at=row["created_at"],
    )


@router.post(
    "/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED
)
async def signup(body: SignupRequest):
    svc = get_supabase_service()

    def _create():
        return svc.auth.admin.create_user(
            {
                "email": body.email,
                "password": body.password,
                "email_confirm": True,
            }
        )

    try:
        auth_res = await asyncio.to_thread(_create)
    except AuthApiError as e:
        msg = getattr(e, "message", str(e)) or ""
        if "already been registered" in msg.lower() or "already exists" in msg.lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="Email already registered"
            ) from e
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=msg or "Signup failed"
        ) from e
    user = getattr(auth_res, "user", None) or getattr(auth_res, "model", None)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Auth user missing",
        )
    uid = getattr(user, "id", None)
    if not uid:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Auth user id missing",
        )
    pool = get_pool()
    try:
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO municipality_users (
                    id, email, first_name, last_name, phone_number,
                    semel_yish, department, role
                )
                VALUES ($1, $2, $3, $4, $5, 2600, $6, 'visitor')
                """,
                UUID(str(uid)),
                str(body.email),
                body.first_name,
                body.last_name,
                body.phone_number,
                body.department,
            )
            await conn.execute(
                """
                INSERT INTO audit_log (user_id, action, entity_type, entity_id, details)
                VALUES ($1, 'signup', 'municipality_user', $2, $3::jsonb)
                """,
                UUID(str(uid)),
                str(uid),
                json.dumps({"email": str(body.email)}),
            )
            row = await conn.fetchrow(
                """
                SELECT id, email, first_name, last_name, phone_number, semel_yish,
                       department, role, is_active, created_at
                FROM municipality_users WHERE id = $1
                """,
                UUID(str(uid)),
            )
    except Exception:

        def _delete():
            svc.auth.admin.delete_user(str(uid))

        await asyncio.to_thread(_delete)
        raise
    return _row_to_user_response(row)


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest):
    anon = get_supabase_anon()

    def _sign_in():
        return anon.auth.sign_in_with_password(
            {"email": body.email, "password": body.password}
        )

    try:
        session_res = await asyncio.to_thread(_sign_in)
    except AuthApiError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        ) from e
    session = getattr(session_res, "session", None)
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="No session"
        )
    access_token = getattr(session, "access_token", None)
    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="No access token"
        )
    user_meta = getattr(session, "user", None)
    uid = getattr(user_meta, "id", None) if user_meta else None
    if not uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="No user id in session"
        )
    pool = get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE municipality_users
            SET last_login_at = NOW(), updated_at = NOW()
            WHERE id = $1
            """,
            UUID(str(uid)),
        )
        row = await conn.fetchrow(
            """
            SELECT id, email, first_name, last_name, phone_number, semel_yish,
                   department, role, is_active, created_at
            FROM municipality_users WHERE id = $1
            """,
            UUID(str(uid)),
        )
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Profile not provisioned",
        )
    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        user=_row_to_user_response(row),
    )


@router.post("/logout")
async def logout():
    # Stateless JWT: client discards tokens. Optional: accept refresh_token body and call sign_out.
    return {"message": "Logged out on client; discard access and refresh tokens."}


@router.get("/me", response_model=UserResponse)
async def read_me(
    current: Annotated[MunicipalityUserRecord, Depends(get_current_user)],
):
    return UserResponse(
        id=current.id,
        email=current.email,
        first_name=current.first_name,
        last_name=current.last_name,
        phone_number=current.phone_number,
        semel_yish=current.semel_yish,
        department=current.department,
        role=current.role,
        is_active=current.is_active,
        created_at=current.created_at,
    )

@router.patch("/me", response_model=UserResponse)
async def update_me(
    body: UpdateUserRequest,
    current: Annotated[MunicipalityUserRecord, Depends(get_current_user)],
):
    updates = body.model_dump(exclude_unset=True)
    if not updates:
        pool = get_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT id, email, first_name, last_name, phone_number, semel_yish,
                       department, role, is_active, created_at
                FROM municipality_users WHERE id = $1
                """,
                current.id,
            )
        return _row_to_user_response(row)
    sets = []
    args = []
    i = 1
    for k, v in updates.items():
        sets.append(f"{k} = ${i}")
        args.append(v)
        i += 1
    sets.append(f"updated_at = ${i}")
    args.append(current.id)
    pool = get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            f"""
            UPDATE municipality_users SET {", ".join(sets)}
            WHERE id = ${i}
            """,
            *args[:-1],
            args[-1],
        )
        await conn.execute(
            """
            INSERT INTO audit_log (user_id, action, entity_type, entity_id, details)
            VALUES ($1, 'profile_update', 'municipality_user', $2, $3::jsonb)
            """,
            current.id,
            str(current.id),
            json.dumps(updates),
        )
        row = await conn.fetchrow(
            """
            SELECT id, email, first_name, last_name, phone_number, semel_yish,
                   department, role, is_active, created_at
            FROM municipality_users WHERE id = $1
            """,
            current.id,
        )
    return _row_to_user_response(row)