from datetime import datetime
from typing import List, Optional, Literal

from pydantic import BaseModel, Field


# Shared models
class ClubBase(BaseModel):
    name: str
    slug: str = Field(..., pattern=r"^[a-zA-Z0-9-_]+$")
    voting_open: bool = True


class ClubCreate(ClubBase):
    pass


class ClubRead(ClubBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class BookBase(BaseModel):
    title: str
    author: Optional[str] = None
    readers_count: int = Field(ge=0)


class BookCreate(BookBase):
    pass


class BookRead(BookBase):
    id: int
    club_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class BookUpdate(BaseModel):
    title: str | None = None
    author: Optional[str] = None
    readers_count: int | None = Field(default=None, ge=0)


class CategoryBase(BaseModel):
    name: str
    description: Optional[str] = None
    sort_order: int = 0
    active: bool = True


class CategoryCreate(CategoryBase):
    pass


class CategoryRead(CategoryBase):
    id: int
    club_id: int

    class Config:
        from_attributes = True


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    sort_order: Optional[int] = None
    active: Optional[bool] = None


class VoterRead(BaseModel):
    id: int
    name: str
    club_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class VoteEntry(BaseModel):
    category_id: int
    book_id: int


class VoteSubmission(BaseModel):
    voter_name: str
    votes: List[VoteEntry]


class VoteRead(BaseModel):
    id: int
    voter_id: int
    category_id: int
    book_id: int

    class Config:
        from_attributes = True


class ClubConfigResponse(BaseModel):
    club: ClubRead
    books: List[BookRead]
    categories: List[CategoryRead]


class VoteSubmissionResponse(BaseModel):
    voter: VoterRead
    updated_votes: List[VoteRead]


class BookResult(BaseModel):
    book_id: int
    title: str
    author: Optional[str]
    readers_count: int
    votes_count: int
    weighted_score: float
    is_winner: bool


class CategoryResult(BaseModel):
    category_id: int
    category_name: str
    results: List[BookResult]


class ResultsResponse(BaseModel):
    club: ClubRead
    categories: List[CategoryResult]


class RevealResultsResponse(BaseModel):
    status: Literal["ok"]
    club: ClubRead
    results: List[CategoryResult]
