from sqlalchemy.orm import Session
from app.models.phase5_models import Notification, NotificationRecipient
from app.models.batch import BatchStudent
from app.models.user import User


class NotificationRepo:
    def __init__(self, db: Session):
        self.db = db

    def create_notification(self, **kwargs) -> Notification:
        n = Notification(**kwargs)
        self.db.add(n)
        self.db.commit()
        self.db.refresh(n)
        return n

    def add_recipients(self, notification_id, user_ids: list):
        # `delivered` marks that an in-app recipient row exists and is
        # retrievable by the user; the previous code left every row at the
        # False default forever.
        recs = [
            NotificationRecipient(notification_id=notification_id, user_id=uid, delivered=True)
            for uid in user_ids
        ]
        self.db.add_all(recs)
        self.db.commit()
        return recs

    def resolve_target_users(self, target_roles: list[str], target_users: list,
                             target_batches: list = None) -> list:
        """Union of explicitly named users, everyone holding one of the given
        roles, and every student enrolled in one of the given batches."""
        ids = set(str(u) for u in target_users)
        if target_roles:
            # Role strings arrive in mixed casing across the frontend
            # ("Super Admin" vs "super_admin"); normalise to the canonical
            # snake_case values stored on User.role.
            normalised = [str(r).strip().lower().replace(" ", "_") for r in target_roles]
            role_users = self.db.query(User.id).filter(User.role.in_(normalised)).all()
            ids.update(str(r[0]) for r in role_users)
        if target_batches:
            batch_users = (
                self.db.query(BatchStudent.user_id)
                .filter(BatchStudent.batch_id.in_(target_batches))
                .distinct()
                .all()
            )
            ids.update(str(r[0]) for r in batch_users)
        return list(ids)

    def mark_sent(self, notification, status="sent"):
        from datetime import datetime, timezone
        notification.status = status
        notification.sent_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(notification)
        return notification

    def list_for_user(self, user_id, unread_only=False):
        q = (
            self.db.query(NotificationRecipient, Notification)
            .join(Notification, Notification.id == NotificationRecipient.notification_id)
            .filter(NotificationRecipient.user_id == user_id)
        )
        if unread_only:
            q = q.filter(NotificationRecipient.is_read == False)  # noqa: E712
        return q.order_by(Notification.created_at.desc()).all()

    def mark_read(self, recipient):
        from datetime import datetime, timezone
        recipient.is_read = True
        recipient.read_at = datetime.now(timezone.utc)
        self.db.commit()
        return recipient

    def get_recipient(self, recipient_id, user_id):
        return (
            self.db.query(NotificationRecipient)
            .filter(NotificationRecipient.id == recipient_id, NotificationRecipient.user_id == user_id)
            .first()
        )

    def list_all(self, skip=0, limit=50):
        return self.db.query(Notification).order_by(Notification.created_at.desc()).offset(skip).limit(limit).all()
