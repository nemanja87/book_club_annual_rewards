from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

try:  # pragma: no cover
    from .database import Base
except ImportError:  # pragma: no cover
    from database import Base


class Club(Base):
    __tablename__ = "clubs"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), nullable=False, unique=True, index=True)
    voting_open = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    books = relationship("Book", back_populates="club", cascade="all, delete-orphan")
    categories = relationship("Category", back_populates="club", cascade="all, delete-orphan")
    voters = relationship("Voter", back_populates="club", cascade="all, delete-orphan")


class Book(Base):
    __tablename__ = "books"

    id = Column(Integer, primary_key=True, index=True)
    club_id = Column(Integer, ForeignKey("clubs.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    author = Column(String(255))
    readers_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    club = relationship("Club", back_populates="books")
    votes = relationship("Vote", back_populates="book")


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    club_id = Column(Integer, ForeignKey("clubs.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    sort_order = Column(Integer, default=0, nullable=False)
    active = Column(Boolean, default=True, nullable=False)

    club = relationship("Club", back_populates="categories")
    votes = relationship("Vote", back_populates="category")


class Voter(Base):
    __tablename__ = "voters"

    id = Column(Integer, primary_key=True, index=True)
    club_id = Column(Integer, ForeignKey("clubs.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    club = relationship("Club", back_populates="voters")
    votes = relationship("Vote", back_populates="voter")

    __table_args__ = (UniqueConstraint("club_id", "name", name="uix_voter_club_name"),)


class Vote(Base):
    __tablename__ = "votes"

    id = Column(Integer, primary_key=True, index=True)
    voter_id = Column(Integer, ForeignKey("voters.id", ondelete="CASCADE"), nullable=False, index=True)
    club_id = Column(Integer, ForeignKey("clubs.id", ondelete="CASCADE"), nullable=False, index=True)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="CASCADE"), nullable=False, index=True)
    book_id = Column(Integer, ForeignKey("books.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    voter = relationship("Voter", back_populates="votes")
    club = relationship("Club")
    category = relationship("Category", back_populates="votes")
    book = relationship("Book", back_populates="votes")

    __table_args__ = (
        UniqueConstraint("voter_id", "category_id", name="uix_vote_voter_category"),
    )


class BestMemberVote(Base):
    __tablename__ = "best_member_votes"

    id = Column(Integer, primary_key=True, index=True)
    voter_id = Column(Integer, ForeignKey("voters.id", ondelete="CASCADE"), nullable=False, index=True)
    club_id = Column(Integer, ForeignKey("clubs.id", ondelete="CASCADE"), nullable=False, index=True)
    nominee_name = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    voter = relationship("Voter")
    club = relationship("Club")

    __table_args__ = (UniqueConstraint("club_id", "voter_id", name="uix_best_member_vote_club_voter"),)


class BestMemberNominee(Base):
    __tablename__ = "best_member_nominees"

    id = Column(Integer, primary_key=True, index=True)
    club_id = Column(Integer, ForeignKey("clubs.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)

    club = relationship("Club")

    __table_args__ = (UniqueConstraint("club_id", "name", name="uix_best_member_nominee_club_name"),)
