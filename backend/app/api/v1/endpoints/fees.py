from datetime import date as date_cls, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_roles
from app.models.user import User
from app.models.fee_structure import FeeStructure, FeeInstallment

router = APIRouter(prefix="/fees", tags=["Fees"])

FEE_ROLES = ("super_admin", "admin", "manager")


def _structure_out(fs: FeeStructure, installments: list[FeeInstallment]) -> dict:
    paid = sum(i.amount for i in installments if i.status == "paid")
    return {
        "id": str(fs.id),
        "studentId": str(fs.student_id),
        "batchId": str(fs.batch_id) if fs.batch_id else None,
        "totalAmount": fs.total_amount,
        "planType": fs.plan_type,
        "paidAmount": paid,
        "pendingAmount": fs.total_amount - paid,
        "createdAt": fs.created_at,
        "installments": [
            {
                "id": str(i.id), "installmentNumber": i.installment_number, "amount": i.amount,
                "dueDate": i.due_date, "status": i.status, "paidAt": i.paid_at,
            }
            for i in sorted(installments, key=lambda x: x.installment_number)
        ],
    }


@router.get("/student/{student_id}")
def get_student_fees(
    student_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*FEE_ROLES)),
):
    structures = db.query(FeeStructure).filter(FeeStructure.student_id == student_id).all()
    out = []
    for fs in structures:
        installments = db.query(FeeInstallment).filter(FeeInstallment.fee_structure_id == fs.id).all()
        out.append(_structure_out(fs, installments))
    return out


@router.get("")
def list_all_fees(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*FEE_ROLES)),
):
    """All fee structures across every student, with the student's name —
    used for the Admin/Manager Fees list page."""
    rows = db.query(FeeStructure, User).join(User, User.id == FeeStructure.student_id).all()
    out = []
    for fs, student in rows:
        installments = db.query(FeeInstallment).filter(FeeInstallment.fee_structure_id == fs.id).all()
        item = _structure_out(fs, installments)
        item["studentName"] = student.name
        item["studentEmail"] = student.email
        out.append(item)
    return out


@router.post("", status_code=201)
def create_fee_structure(
    payload: dict,
    # {"studentId": str, "batchId": str|None, "totalAmount": float, "planType": "one_time"|"installment",
    #  "installments": [{"amount": float, "dueDate": "YYYY-MM-DD"|None}]}
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*FEE_ROLES)),
):
    student_id = payload.get("studentId")
    total_amount = float(payload.get("totalAmount", 0))
    plan_type = payload.get("planType", "one_time")
    installments_payload = payload.get("installments") or []

    if plan_type == "one_time" and not installments_payload:
        installments_payload = [{"amount": total_amount, "dueDate": payload.get("dueDate")}]

    if not installments_payload:
        raise HTTPException(status_code=400, detail="At least one installment is required")

    fs = FeeStructure(
        student_id=student_id, batch_id=payload.get("batchId"),
        total_amount=total_amount, plan_type=plan_type, created_by=current_user.id,
    )
    db.add(fs)
    db.flush()

    for i, inst in enumerate(installments_payload, start=1):
        due = date_cls.fromisoformat(inst["dueDate"]) if inst.get("dueDate") else None
        db.add(FeeInstallment(
            fee_structure_id=fs.id, installment_number=i,
            amount=float(inst["amount"]), due_date=due,
        ))
    db.commit()

    installments = db.query(FeeInstallment).filter(FeeInstallment.fee_structure_id == fs.id).all()
    return _structure_out(fs, installments)


@router.put("/installments/{installment_id}/status")
def update_installment_status(
    installment_id: UUID,
    payload: dict,  # {"status": "pending"|"paid"|"overdue"}
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*FEE_ROLES)),
):
    inst = db.query(FeeInstallment).filter(FeeInstallment.id == installment_id).first()
    if not inst:
        raise HTTPException(status_code=404, detail="Installment not found")
    inst.status = payload.get("status", inst.status)
    if inst.status == "paid":
        inst.paid_at = datetime.utcnow()
    db.commit()
    return {"id": str(inst.id), "status": inst.status}
