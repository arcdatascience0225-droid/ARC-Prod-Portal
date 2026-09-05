"""Student fee plans — separate from `Payment` (which records individual
paid transactions). A FeeStructure is the plan (total amount, one-time or
installment), and each FeeInstallment is one due payment within that plan
(for a one-time plan, there's exactly one installment covering the full
amount).
"""
import uuid
from datetime import datetime

from sqlalchemy import Column, String, Float, Date, DateTime, ForeignKey, Integer
from app.core.db_types import UUID
from app.core.database import Base


class FeeStructure(Base):
    __tablename__ = "fee_structures"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    batch_id = Column(UUID(as_uuid=True), ForeignKey("batches.id"), nullable=True)
    total_amount = Column(Float, nullable=False)
    plan_type = Column(String(20), nullable=False, default="one_time")  # one_time | installment
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class FeeInstallment(Base):
    __tablename__ = "fee_installments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    fee_structure_id = Column(UUID(as_uuid=True), ForeignKey("fee_structures.id"), nullable=False)
    installment_number = Column(Integer, nullable=False, default=1)
    amount = Column(Float, nullable=False)
    due_date = Column(Date, nullable=True)
    status = Column(String(20), nullable=False, default="pending")  # pending | paid | overdue
    paid_at = Column(DateTime, nullable=True)
