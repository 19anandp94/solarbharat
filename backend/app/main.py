import os
import random
import secrets
from datetime import datetime, timezone

from fastapi import Depends, FastAPI, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import DateTime, String, create_engine, text
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, relationship

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./dga_bharat_solar.db")
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)


class Base(DeclarativeBase):
    pass


class Lead(Base):
    __tablename__ = "leads"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    phone: Mapped[str] = mapped_column(String(20), index=True)
    email: Mapped[str | None] = mapped_column(String(120), nullable=True)
    city: Mapped[str] = mapped_column(String(100))
    electricity_bill: Mapped[str] = mapped_column(String(40))
    status: Mapped[str] = mapped_column(String(30), default="New")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class Installation(Base):
    __tablename__ = "installations"
    id: Mapped[int] = mapped_column(primary_key=True)
    phone: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    customer_name: Mapped[str] = mapped_column(String(100))
    capacity: Mapped[str] = mapped_column(String(30))
    current_step: Mapped[int] = mapped_column(default=1)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


Base.metadata.create_all(engine)

# Lightweight migration for existing local SQLite databases. Use a proper
# migration tool (Alembic) when deploying PostgreSQL in production.
with engine.begin() as connection:
    if DATABASE_URL.startswith("sqlite"):
        columns = {row[1] for row in connection.execute(text("PRAGMA table_info(leads)"))}
        if "status" not in columns:
            connection.execute(text("ALTER TABLE leads ADD COLUMN status VARCHAR(30) NOT NULL DEFAULT 'New'"))

app = FastAPI(title="DGA Bharat Solar API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

STEPS = ["Site assessment", "Design & approval", "Installation", "Inspection & switch-on"]
otp_store: dict[str, str] = {}
admin_tokens: set[str] = set()
admin_security = HTTPBearer()
ADMIN_USERNAME = os.getenv("DGA_ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("DGA_ADMIN_PASSWORD", "change-me-before-production")


class LeadPayload(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    phone: str = Field(min_length=8, max_length=20)
    email: EmailStr | None = None
    city: str = Field(min_length=2, max_length=100)
    electricity_bill: str = Field(min_length=1, max_length=40)


class PhonePayload(BaseModel):
    phone: str = Field(min_length=8, max_length=20)


class VerifyPayload(PhonePayload):
    otp: str = Field(min_length=4, max_length=6)


class AdminLoginPayload(BaseModel):
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)


class LeadStatusPayload(BaseModel):
    status: str = Field(min_length=1, max_length=30)


def require_admin(credentials: HTTPAuthorizationCredentials = Depends(admin_security)):
    if credentials.scheme.lower() != "bearer" or credentials.credentials not in admin_tokens:
        raise HTTPException(status_code=401, detail="Admin sign-in is required.")


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/leads", status_code=201)
def create_lead(payload: LeadPayload):
    with Session(engine) as session:
        lead = Lead(**payload.model_dump())
        session.add(lead)
        session.commit()
    return {"message": "Thanks! Our solar advisor will call you within one business day."}


@app.post("/api/admin/login")
def admin_login(payload: AdminLoginPayload):
    if not secrets.compare_digest(payload.username, ADMIN_USERNAME) or not secrets.compare_digest(payload.password, ADMIN_PASSWORD):
        raise HTTPException(status_code=401, detail="Incorrect username or password.")
    token = secrets.token_urlsafe(32)
    admin_tokens.add(token)
    return {"token": token}


@app.get("/api/admin/leads", dependencies=[Depends(require_admin)])
def list_leads(query: str = ""):
    with Session(engine) as session:
        leads = session.query(Lead).order_by(Lead.created_at.desc()).all()
        if query:
            keyword = query.lower()
            leads = [lead for lead in leads if keyword in f"{lead.name} {lead.phone} {lead.city}".lower()]
    return [{
        "id": lead.id, "name": lead.name, "phone": lead.phone, "email": lead.email,
        "city": lead.city, "electricity_bill": lead.electricity_bill, "status": lead.status,
        "created_at": lead.created_at.isoformat(),
    } for lead in leads]


@app.patch("/api/admin/leads/{lead_id}", dependencies=[Depends(require_admin)])
def update_lead_status(lead_id: int, payload: LeadStatusPayload):
    with Session(engine) as session:
        lead = session.get(Lead, lead_id)
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found.")
        lead.status = payload.status
        session.commit()
    return {"message": "Lead status updated."}


@app.post("/api/auth/request-otp")
def request_otp(payload: PhonePayload):
    otp = str(random.randint(100000, 999999))
    otp_store[payload.phone] = otp
    # Integrate an SMS provider here. Exposed only for local development.
    return {"message": "Verification code sent.", "development_otp": otp}


@app.post("/api/auth/verify")
def verify_otp(payload: VerifyPayload):
    if otp_store.get(payload.phone) != payload.otp:
        raise HTTPException(status_code=401, detail="That code is incorrect. Please try again.")
    with Session(engine) as session:
        installation = session.query(Installation).filter_by(phone=payload.phone).first()
        if not installation:
            installation = Installation(
                phone=payload.phone,
                customer_name="Solar customer",
                capacity="Your system",
                current_step=1,
            )
            session.add(installation)
            session.commit()
            session.refresh(installation)
    return {
        "customer_name": installation.customer_name,
        "capacity": installation.capacity,
        "current_step": installation.current_step,
        "steps": STEPS,
        "updated_at": installation.updated_at.isoformat(),
    }
