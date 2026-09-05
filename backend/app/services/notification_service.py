from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.repositories.notification_repo import NotificationRepo
from app.repositories.admin_platform_repo import AdminRepo
from app.services.email_service import send_email, send_sms
from app.models.user import User


class NotificationService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = NotificationRepo(db)
        self.admin_repo = AdminRepo(db)

    def create_and_dispatch(self, actor, data):
        target_batches = list(getattr(data, "targetBatches", []) or [])
        notification = self.repo.create_notification(
            title=data.title, message=data.message, type=data.type, channel=data.channel,
            created_by=actor.id, target_roles=data.targetRoles,
            target_users=[str(u) for u in data.targetUsers], scheduled_at=data.scheduledAt,
        )
        user_ids = self.repo.resolve_target_users(
            data.targetRoles, data.targetUsers, target_batches
        )
        if not user_ids:
            raise HTTPException(400, "No recipients matched the selected roles/batches/users")
        self.repo.add_recipients(notification.id, user_ids)

        if not data.scheduledAt:
            self._dispatch(notification, user_ids)
        self.admin_repo.add_audit_log(actor.id, "send_notification", "notifications", "notification", notification.id, {"recipients": len(user_ids)})
        return notification

    def _dispatch(self, notification, user_ids):
        sent_any = False
        if notification.channel in ("email",):
            users = self.db.query(User).filter(User.id.in_(user_ids)).all()
            for u in users:
                if send_email(u.email, notification.title, notification.message):
                    sent_any = True
        elif notification.channel == "sms":
            users = self.db.query(User).filter(User.id.in_(user_ids)).all()
            for u in users:
                phone = getattr(u, "phone", None)
                if phone and send_sms(phone, notification.message):
                    sent_any = True
        else:
            # in_app / push: recipient rows already created, considered delivered
            sent_any = True
        self.repo.mark_sent(notification, "sent" if sent_any else "failed")

    def broadcast(self, actor, data):
        from app.schemas.notifications import NotificationCreate
        payload = NotificationCreate(
            title=data.title, message=data.message, type="broadcast",
            channel=data.channel, targetRoles=data.roles, targetUsers=[],
            targetBatches=list(getattr(data, "batchIds", []) or []),
        )
        return self.create_and_dispatch(actor, payload)

    def trigger_event(self, event_type: str, user_id, title: str, message: str, channel: str = "in_app"):
        """Called internally by other modules e.g. assessment scheduling, result publishing."""
        notification = self.repo.create_notification(
            title=title, message=message, type=event_type, channel=channel,
            created_by=None, target_roles=[], target_users=[str(user_id)],
        )  # noqa: E501
        self.repo.add_recipients(notification.id, [str(user_id)])
        self._dispatch(notification, [str(user_id)])
        return notification

    def list_for_user(self, user_id, unread_only=False):
        return self.repo.list_for_user(user_id, unread_only)

    def mark_read(self, user_id, recipient_id):
        rec = self.repo.get_recipient(recipient_id, user_id)
        if not rec:
            raise HTTPException(404, "Notification not found")
        return self.repo.mark_read(rec)

    def list_all(self, skip=0, limit=50):
        return self.repo.list_all(skip, limit)
