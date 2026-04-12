"""
Notification endpoints - API routes for fetching and managing notifications
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import datetime
from typing import List

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.notification import Notification
from app.schemas.notification import NotificationSchema, NotificationUpdateSchema

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=List[NotificationSchema])
async def get_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 50,
) -> List[NotificationSchema]:
    """
    Get all notifications for the current user, sorted by most recent first.
    """
    notifications = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(desc(Notification.created_at))
        .offset(skip)
        .limit(limit)
        .all()
    )
    return notifications


@router.get("/unread/count")
async def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Get the count of unread notifications for the current user.
    """
    count = (
        db.query(Notification)
        .filter(
            Notification.user_id == current_user.id,
            Notification.is_read == False
        )
        .count()
    )
    return {"unread_count": count}


@router.patch("/{notification_id}", response_model=NotificationSchema)
async def mark_notification_as_read(
    notification_id: int,
    update_data: NotificationUpdateSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> NotificationSchema:
    """
    Update a notification (e.g., mark as read/unread).
    """
    notification = (
        db.query(Notification)
        .filter(
            Notification.id == notification_id,
            Notification.user_id == current_user.id
        )
        .first()
    )

    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    if update_data.is_read is not None:
        notification.is_read = update_data.is_read
        if update_data.is_read:
            notification.read_at = datetime.utcnow()
        else:
            notification.read_at = None

    db.commit()
    db.refresh(notification)
    return notification


@router.post("/mark-all-as-read")
async def mark_all_as_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Mark all notifications as read for the current user.
    """
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).update(
        {
            Notification.is_read: True,
            Notification.read_at: datetime.utcnow()
        },
        synchronize_session=False
    )
    db.commit()
    return {"status": "success"}
