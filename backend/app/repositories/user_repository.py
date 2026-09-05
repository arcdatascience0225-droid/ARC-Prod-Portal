import uuid
from typing import Optional

from sqlalchemy.orm import Session
from sqlalchemy import select

from app.models.user import User


class UserRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, user_id: uuid.UUID) -> Optional[User]:
        return self.db.query(User).filter(User.id == user_id).first()

    def get_by_email(self, email: str) -> Optional[User]:
        return self.db.query(User).filter(User.email == email.lower()).first()

    def create(self, **kwargs) -> User:
        user = User(**kwargs)
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def update(self, user: User, **kwargs) -> User:
        for k, v in kwargs.items():
            setattr(user, k, v)
        self.db.commit()
        self.db.refresh(user)
        return user

    def list_all(self, skip: int = 0, limit: int = 50, role: Optional[str] = None, search: Optional[str] = None):
        query = self.db.query(User)
        if role:
            query = query.filter(User.role == role)
        if search:
            like = f"%{search}%"
            query = query.filter((User.name.ilike(like)) | (User.email.ilike(like)))
        total = query.count()
        items = query.order_by(User.created_at.desc()).offset(skip).limit(limit).all()
        return items, total

    def delete(self, user: User):
        self.db.delete(user)
        self.db.commit()
