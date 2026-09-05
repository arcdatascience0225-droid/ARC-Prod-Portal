from uuid import UUID
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_roles
from app.models.lead import Lead
from app.models.user import User
from app.schemas.lead import LeadCreate, LeadUpdate, LeadOut

router = APIRouter(prefix="/leads", tags=["Counsellor - Leads"])

LEAD_ROLES = ("counsellor", "super_admin")


def _to_out(lead: Lead) -> LeadOut:
    return LeadOut(
        id=lead.id, name=lead.name, phone=lead.phone, email=lead.email,
        courseInterested=lead.course_interested, requirement=lead.requirement,
        source=lead.source, status=lead.status, notes=lead.notes,
        createdAt=lead.created_at, updatedAt=lead.updated_at,
    )


@router.get("", response_model=list[LeadOut])
def list_leads(
    status: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*LEAD_ROLES)),
):
    q = db.query(Lead)
    if status:
        q = q.filter(Lead.status == status)
    if search:
        like = f"%{search.strip().lower()}%"
        from sqlalchemy import func, or_
        q = q.filter(or_(func.lower(Lead.name).like(like), func.lower(Lead.phone).like(like), func.lower(Lead.email).like(like)))
    leads = q.order_by(Lead.created_at.desc()).all()
    return [_to_out(l) for l in leads]


@router.post("", response_model=LeadOut, status_code=201)
def create_lead(
    payload: LeadCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*LEAD_ROLES)),
):
    lead = Lead(
        name=payload.name, phone=payload.phone, email=payload.email,
        course_interested=payload.courseInterested, requirement=payload.requirement,
        source=payload.source, notes=payload.notes,
        assigned_to=current_user.id, created_by=current_user.id,
    )
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return _to_out(lead)


@router.put("/{lead_id}", response_model=LeadOut)
def update_lead(
    lead_id: UUID,
    payload: LeadUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*LEAD_ROLES)),
):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    data = payload.model_dump(exclude_unset=True)
    field_map = {"courseInterested": "course_interested"}
    for k, v in data.items():
        setattr(lead, field_map.get(k, k), v)
    db.commit()
    db.refresh(lead)
    return _to_out(lead)


@router.delete("/{lead_id}", status_code=204)
def delete_lead(
    lead_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*LEAD_ROLES)),
):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    db.delete(lead)
    db.commit()
