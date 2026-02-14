from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    avatar_base64: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    transactions: Mapped[list["Transaction"]] = relationship(back_populates="user")


class Warehouse(Base):
    __tablename__ = "warehouses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(64), unique=True, index=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    lots: Mapped[list["Lot"]] = relationship(back_populates="warehouse")


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(64), unique=True, index=True)


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(64), unique=True, index=True)


class LotCategory(Base):
    __tablename__ = "lot_categories"
    lot_uid: Mapped[int] = mapped_column(BigInteger, ForeignKey("lots.uid", ondelete="CASCADE"), primary_key=True)
    category_id: Mapped[int] = mapped_column(Integer, ForeignKey("categories.id", ondelete="CASCADE"), primary_key=True)


class LotTag(Base):
    __tablename__ = "lot_tags"
    lot_uid: Mapped[int] = mapped_column(BigInteger, ForeignKey("lots.uid", ondelete="CASCADE"), primary_key=True)
    tag_id: Mapped[int] = mapped_column(Integer, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True)


class Lot(Base):
    __tablename__ = "lots"
    __table_args__ = (
        CheckConstraint("uid >= 1 AND uid <= 4294967294", name="ck_lots_uid_u32"),
    )

    uid: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    warehouse_id: Mapped[int] = mapped_column(Integer, ForeignKey("warehouses.id", ondelete="CASCADE"), index=True)

    name: Mapped[str] = mapped_column(String(200), index=True)
    quantity: Mapped[int] = mapped_column(Integer, default=0)
    price: Mapped[Optional[float]] = mapped_column(Numeric(12, 2), nullable=True)
    currency: Mapped[str] = mapped_column(String(8), default="RUB")
    purchase_url: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    image_base64: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    warehouse: Mapped["Warehouse"] = relationship(back_populates="lots")
    categories: Mapped[list["Category"]] = relationship(
        secondary="lot_categories",
        lazy="selectin",
    )
    tags: Mapped[list["Tag"]] = relationship(
        secondary="lot_tags",
        lazy="selectin",
    )

    transactions: Mapped[list["Transaction"]] = relationship(back_populates="lot")


class Transaction(Base):
    __tablename__ = "transactions"
    __table_args__ = (
        UniqueConstraint("id", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    lot_uid: Mapped[int] = mapped_column(BigInteger, ForeignKey("lots.uid", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    action: Mapped[str] = mapped_column(String(16))  # add|consume|adjust
    delta: Mapped[int] = mapped_column(Integer)
    note: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    lot: Mapped["Lot"] = relationship(back_populates="transactions")
    user: Mapped[Optional["User"]] = relationship(back_populates="transactions")
