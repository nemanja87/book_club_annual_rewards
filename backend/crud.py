from typing import List, Tuple

from fastapi import HTTPException, status
from sqlalchemy import Select, delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

try:  # pragma: no cover
    from . import models, schemas
except ImportError:  # pragma: no cover
    import models  # type: ignore
    import schemas  # type: ignore


def list_clubs(db: Session) -> List[models.Club]:
    stmt: Select[tuple[models.Club]] = select(models.Club).order_by(models.Club.created_at)
    return list(db.scalars(stmt))


def get_club_by_slug(db: Session, slug: str) -> models.Club:
    stmt = select(models.Club).where(models.Club.slug == slug)
    club = db.scalar(stmt)
    if not club:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Club not found")
    return club


def create_club(db: Session, club_in: schemas.ClubCreate) -> models.Club:
    club = models.Club(**club_in.dict())
    db.add(club)
    try:
        db.commit()
    except IntegrityError as exc:  # slug uniqueness
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Slug already exists") from exc
    db.refresh(club)
    return club


def create_book(db: Session, club: models.Club, book_in: schemas.BookCreate) -> models.Book:
    book = models.Book(club_id=club.id, **book_in.dict())
    db.add(book)
    db.commit()
    db.refresh(book)
    return book


def update_book(db: Session, club: models.Club, book_id: int, book_in: schemas.BookUpdate) -> models.Book:
    stmt = select(models.Book).where(models.Book.id == book_id, models.Book.club_id == club.id)
    book = db.scalar(stmt)
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")
    if book_in.title is not None:
        book.title = book_in.title
    if book_in.author is not None:
        book.author = book_in.author
    if book_in.readers_count is not None:
        book.readers_count = book_in.readers_count
    db.add(book)
    db.commit()
    db.refresh(book)
    return book


def list_books(db: Session, club: models.Club) -> List[models.Book]:
    stmt = select(models.Book).where(models.Book.club_id == club.id).order_by(models.Book.created_at)
    return list(db.scalars(stmt))


def delete_book(db: Session, club: models.Club, book_id: int) -> None:
    stmt = select(models.Book).where(models.Book.id == book_id, models.Book.club_id == club.id)
    book = db.scalar(stmt)
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")

    db.execute(delete(models.Vote).where(models.Vote.club_id == club.id, models.Vote.book_id == book.id))
    db.delete(book)
    db.commit()


def create_category(db: Session, club: models.Club, category_in: schemas.CategoryCreate) -> models.Category:
    category = models.Category(club_id=club.id, **category_in.dict())
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


def update_category(
    db: Session, club: models.Club, category_id: int, category_in: schemas.CategoryUpdate
) -> models.Category:
    stmt = select(models.Category).where(models.Category.id == category_id, models.Category.club_id == club.id)
    category = db.scalar(stmt)
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    if category_in.name is not None:
        category.name = category_in.name
    if category_in.description is not None:
        category.description = category_in.description
    if category_in.sort_order is not None:
        category.sort_order = category_in.sort_order
    if category_in.active is not None:
        category.active = category_in.active
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


def list_categories(db: Session, club: models.Club, *, include_inactive: bool = True) -> List[models.Category]:
    stmt = (
        select(models.Category)
        .where(models.Category.club_id == club.id)
        .order_by(models.Category.sort_order, models.Category.id)
    )
    if not include_inactive:
        stmt = stmt.where(models.Category.active.is_(True))
    return list(db.scalars(stmt))


def delete_category(db: Session, club: models.Club, category_id: int) -> None:
    stmt = select(models.Category).where(models.Category.id == category_id, models.Category.club_id == club.id)
    category = db.scalar(stmt)
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    db.execute(delete(models.Vote).where(models.Vote.club_id == club.id, models.Vote.category_id == category.id))
    db.delete(category)
    db.commit()


def set_voting_state(db: Session, club: models.Club, *, open_state: bool) -> models.Club:
    club.voting_open = open_state
    db.add(club)
    db.commit()
    db.refresh(club)
    return club


def _get_or_create_voter(db: Session, club: models.Club, voter_name: str) -> models.Voter:
    name = voter_name.strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Voter name is required")

    stmt = select(models.Voter).where(models.Voter.club_id == club.id, models.Voter.name == name)
    voter = db.scalar(stmt)
    if voter:
        return voter

    voter = models.Voter(club_id=club.id, name=name)
    db.add(voter)
    try:
        db.commit()
    except IntegrityError:  # race condition for same name
        db.rollback()
        voter = db.scalar(stmt)
        if voter:
            return voter
        raise
    db.refresh(voter)
    return voter


def submit_votes(
    db: Session, club: models.Club, payload: schemas.VoteSubmission
) -> Tuple[models.Voter, List[models.Vote]]:
    if not club.voting_open:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Voting is closed for this club")

    voter = _get_or_create_voter(db, club, payload.voter_name)

    # Preload valid ids for quick validation
    categories = {cat.id: cat for cat in list_categories(db, club, include_inactive=False)}
    books = {book.id: book for book in list_books(db, club)}

    updates: List[models.Vote] = []
    for vote in payload.votes:
        category = categories.get(vote.category_id)
        book = books.get(vote.book_id)
        if not category:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid category {vote.category_id}")
        if not book:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid book {vote.book_id}")

        stmt = select(models.Vote).where(
            models.Vote.voter_id == voter.id,
            models.Vote.category_id == category.id,
        )
        existing = db.scalar(stmt)
        if existing:
            existing.book_id = book.id
            db.add(existing)
            updates.append(existing)
        else:
            new_vote = models.Vote(
                voter_id=voter.id,
                club_id=club.id,
                category_id=category.id,
                book_id=book.id,
            )
            db.add(new_vote)
            updates.append(new_vote)
    db.commit()
    for vote in updates:
        db.refresh(vote)
    return voter, updates


def get_results(db: Session, club: models.Club) -> schemas.ResultsResponse:
    categories = list_categories(db, club)
    category_results: List[schemas.CategoryResult] = []

    for category in categories:
        stmt = (
            select(models.Book, func.count(models.Vote.id).label("votes_count"))
            .join(models.Vote, models.Book.id == models.Vote.book_id)
            .where(models.Vote.category_id == category.id)
            .group_by(models.Book.id)
        )
        rows = db.execute(stmt).all()
        if not rows:
            category_results.append(
                schemas.CategoryResult(
                    category_id=category.id,
                    category_name=category.name,
                    results=[],
                )
            )
            continue

        book_entries: List[schemas.BookResult] = []
        winner_idx = -1
        best_score = -1.0
        best_votes = -1
        for idx, (book, votes_count) in enumerate(rows):
            readers = max(book.readers_count, 0)
            weighted = (votes_count / readers) if readers > 0 else 0.0
            if weighted > best_score or (weighted == best_score and votes_count > best_votes):
                best_score = weighted
                best_votes = votes_count
                winner_idx = idx
            book_entries.append(
                schemas.BookResult(
                    book_id=book.id,
                    title=book.title,
                    author=book.author,
                    readers_count=readers,
                    votes_count=votes_count,
                    weighted_score=round(weighted, 4),
                    is_winner=False,
                )
            )
        if winner_idx >= 0:
            book_entries[winner_idx].is_winner = True

        book_entries.sort(key=lambda item: item.weighted_score, reverse=True)
        category_results.append(
            schemas.CategoryResult(
                category_id=category.id,
                category_name=category.name,
                results=book_entries,
            )
        )

    return schemas.ResultsResponse(club=schemas.ClubRead.model_validate(club), categories=category_results)
