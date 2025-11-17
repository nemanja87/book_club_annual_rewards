from fastapi import Depends, FastAPI, Header, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

try:  # pragma: no cover
    from . import crud, models, schemas
    from .config import get_settings
    from .database import Base, engine, get_db
except ImportError:  # pragma: no cover
    import crud  # type: ignore
    import models  # type: ignore
    import schemas  # type: ignore
    from config import get_settings  # type: ignore
    from database import Base, engine, get_db  # type: ignore

settings = get_settings()
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Book Club Awards API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.allow_origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def verify_admin_secret(
    admin_secret_header: str | None = Header(default=None, alias="X-Admin-Secret"),
    admin_secret_query: str | None = Query(default=None, alias="admin_secret"),
):
    provided = admin_secret_header or admin_secret_query
    if provided != settings.admin_secret:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin secret")


# Admin endpoints
@app.post("/api/admin/clubs", response_model=schemas.ClubRead, dependencies=[Depends(verify_admin_secret)])
def create_club(club_in: schemas.ClubCreate, db: Session = Depends(get_db)):
    return crud.create_club(db, club_in)


@app.get("/api/admin/clubs", response_model=list[schemas.ClubRead], dependencies=[Depends(verify_admin_secret)])
def list_clubs(db: Session = Depends(get_db)):
    return crud.list_clubs(db)


@app.get(
    "/api/admin/clubs/{club_slug}",
    response_model=schemas.ClubConfigResponse,
    dependencies=[Depends(verify_admin_secret)],
)
def get_club_detail(club_slug: str, db: Session = Depends(get_db)):
    club = crud.get_club_by_slug(db, club_slug)
    books = crud.list_books(db, club)
    categories = crud.list_categories(db, club)
    return schemas.ClubConfigResponse(
        club=schemas.ClubRead.model_validate(club),
        books=[schemas.BookRead.model_validate(book) for book in books],
        categories=[schemas.CategoryRead.model_validate(cat) for cat in categories],
    )


@app.post(
    "/api/admin/clubs/{club_slug}/books",
    response_model=schemas.BookRead,
    dependencies=[Depends(verify_admin_secret)],
)
def create_book(club_slug: str, book_in: schemas.BookCreate, db: Session = Depends(get_db)):
    club = crud.get_club_by_slug(db, club_slug)
    book = crud.create_book(db, club, book_in)
    return schemas.BookRead.model_validate(book)


@app.get(
    "/api/admin/clubs/{club_slug}/books",
    response_model=list[schemas.BookRead],
    dependencies=[Depends(verify_admin_secret)],
)
def list_books(club_slug: str, db: Session = Depends(get_db)):
    club = crud.get_club_by_slug(db, club_slug)
    books = crud.list_books(db, club)
    return [schemas.BookRead.model_validate(book) for book in books]


@app.post(
    "/api/admin/clubs/{club_slug}/categories",
    response_model=schemas.CategoryRead,
    dependencies=[Depends(verify_admin_secret)],
)
def create_category(club_slug: str, category_in: schemas.CategoryCreate, db: Session = Depends(get_db)):
    club = crud.get_club_by_slug(db, club_slug)
    category = crud.create_category(db, club, category_in)
    return schemas.CategoryRead.model_validate(category)


@app.get(
    "/api/admin/clubs/{club_slug}/categories",
    response_model=list[schemas.CategoryRead],
    dependencies=[Depends(verify_admin_secret)],
)
def list_categories(club_slug: str, db: Session = Depends(get_db)):
    club = crud.get_club_by_slug(db, club_slug)
    categories = crud.list_categories(db, club)
    return [schemas.CategoryRead.model_validate(cat) for cat in categories]


@app.post(
    "/api/admin/clubs/{club_slug}/voting/open",
    response_model=schemas.ClubRead,
    dependencies=[Depends(verify_admin_secret)],
)
def open_voting(club_slug: str, db: Session = Depends(get_db)):
    club = crud.get_club_by_slug(db, club_slug)
    updated = crud.set_voting_state(db, club, open_state=True)
    return schemas.ClubRead.model_validate(updated)


@app.post(
    "/api/admin/clubs/{club_slug}/voting/close",
    response_model=schemas.ClubRead,
    dependencies=[Depends(verify_admin_secret)],
)
def close_voting(club_slug: str, db: Session = Depends(get_db)):
    club = crud.get_club_by_slug(db, club_slug)
    updated = crud.set_voting_state(db, club, open_state=False)
    return schemas.ClubRead.model_validate(updated)


@app.get(
    "/api/admin/clubs/{club_slug}/results",
    response_model=schemas.ResultsResponse,
    dependencies=[Depends(verify_admin_secret)],
)
def admin_results(club_slug: str, db: Session = Depends(get_db)):
    club = crud.get_club_by_slug(db, club_slug)
    return crud.get_results(db, club)


# Public endpoints
@app.get("/api/clubs/{club_slug}/config", response_model=schemas.ClubConfigResponse)
def public_config(club_slug: str, db: Session = Depends(get_db)):
    club = crud.get_club_by_slug(db, club_slug)
    books = crud.list_books(db, club)
    categories = crud.list_categories(db, club, include_inactive=False)
    return schemas.ClubConfigResponse(
        club=schemas.ClubRead.model_validate(club),
        books=[schemas.BookRead.model_validate(book) for book in books],
        categories=[schemas.CategoryRead.model_validate(cat) for cat in categories],
    )


@app.post("/api/clubs/{club_slug}/vote", response_model=schemas.VoteSubmissionResponse)
def submit_vote(club_slug: str, payload: schemas.VoteSubmission, db: Session = Depends(get_db)):
    club = crud.get_club_by_slug(db, club_slug)
    voter, votes = crud.submit_votes(db, club, payload)
    return schemas.VoteSubmissionResponse(
        voter=schemas.VoterRead.model_validate(voter),
        updated_votes=[schemas.VoteRead.model_validate(vote) for vote in votes],
    )


@app.get("/api/clubs/{club_slug}/results/summary", response_model=schemas.ResultsResponse)
def public_results(club_slug: str, db: Session = Depends(get_db)):
    club = crud.get_club_by_slug(db, club_slug)
    if club.voting_open:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Voting still open")
    return crud.get_results(db, club)
