from uuid import UUID
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.core.deps import require_roles, get_current_user
from app.services.notification_service import NotificationService
from app.schemas import notifications as schemas

router = APIRouter(prefix="/notifications", tags=["Notifications"])

STAFF_ROLES = ("Super Admin", "Admin", "Faculty", "Trainer", "HR", "Placement Coordinator")


@router.post("", response_model=schemas.NotificationOut, status_code=201)
def create_notification(payload: schemas.NotificationCreate, db: Session = Depends(get_db),
                         actor=Depends(require_roles(*STAFF_ROLES))):
    return NotificationService(db).create_and_dispatch(actor, payload)


@router.post("/broadcast", response_model=schemas.NotificationOut, status_code=201)
def broadcast(payload: schemas.BroadcastRequest, db: Session = Depends(get_db),
              actor=Depends(require_roles(*STAFF_ROLES))):
    """Role- and/or batch-targeted broadcast. Open to all staff (was Super
    Admin/Admin only), and now accepts `batchIds` so Faculty/HR can reach a
    batch here rather than through a second, parallel subsystem."""
    return NotificationService(db).broadcast(actor, payload)


@router.get("/mine")
def my_notifications(unread_only: bool = False, db: Session = Depends(get_db),
                      current_user=Depends(get_current_user)):
    rows = NotificationService(db).list_for_user(current_user.id, unread_only)
    return [
        {
            "recipientId": rec.id, "notificationId": notif.id, "title": notif.title,
            "message": notif.message, "type": notif.type, "isRead": rec.is_read,
            "createdAt": notif.created_at,
        }
        for rec, notif in rows
    ]


@router.put("/mine/{recipient_id}/read")
def mark_read(recipient_id: UUID, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    NotificationService(db).mark_read(current_user.id, recipient_id)
    return {"message": "Marked as read"}


@router.get("", response_model=list[schemas.NotificationOut])
def list_all(skip: int = 0, limit: int = 50, db: Session = Depends(get_db),
             actor=Depends(require_roles(*STAFF_ROLES))):
    return NotificationService(db).list_all(skip, limit)
