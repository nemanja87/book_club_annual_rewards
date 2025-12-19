from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.exc import OperationalError

try:  # pragma: no cover
    from .config import get_settings
except ImportError:  # pragma: no cover
    from config import get_settings


settings = get_settings()
connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args, future=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)
Base = declarative_base()


@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):  # pragma: no cover
    if settings.database_url.startswith("sqlite"):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


def ensure_sqlite_schema():
    """
    Perform lightweight, in-place upgrades for SQLite databases that may have been created
    with an older schema (e.g., missing votes.book_id / votes.created_at / legacy entity columns).
    """
    if not settings.database_url.startswith("sqlite"):
        return

    with engine.begin() as conn:
        try:
            vote_info = list(conn.exec_driver_sql("PRAGMA table_info(votes);"))
            vote_columns = {row[1] for row in vote_info}
        except OperationalError:
            return

        if not vote_columns:
            return

        if "book_id" not in vote_columns:
            conn.exec_driver_sql("ALTER TABLE votes ADD COLUMN book_id INTEGER;")
            if "entity_id" in vote_columns:
                conn.exec_driver_sql("UPDATE votes SET book_id = entity_id;")

        if "created_at" not in vote_columns:
            conn.exec_driver_sql("ALTER TABLE votes ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP;")

        # Legacy schema had entity_type/entity_id columns with NOT NULL constraint; rebuild if present.
        if "entity_type" in vote_columns or "entity_id" in vote_columns:
            conn.exec_driver_sql(
                """
                CREATE TABLE IF NOT EXISTS votes_mig (
                    id INTEGER PRIMARY KEY,
                    voter_id INTEGER NOT NULL,
                    club_id INTEGER NOT NULL,
                    category_id INTEGER NOT NULL,
                    book_id INTEGER NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
                    FOREIGN KEY(voter_id) REFERENCES voters(id) ON DELETE CASCADE,
                    FOREIGN KEY(club_id) REFERENCES clubs(id) ON DELETE CASCADE,
                    FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE CASCADE,
                    FOREIGN KEY(book_id) REFERENCES books(id) ON DELETE CASCADE
                );
                """
            )
            conn.exec_driver_sql(
                """
                INSERT INTO votes_mig (id, voter_id, club_id, category_id, book_id, created_at)
                SELECT id,
                       voter_id,
                       club_id,
                       category_id,
                       COALESCE(book_id, entity_id) as book_id,
                       COALESCE(created_at, CURRENT_TIMESTAMP)
                FROM votes;
                """
            )
            conn.exec_driver_sql("DROP TABLE votes;")
            conn.exec_driver_sql("ALTER TABLE votes_mig RENAME TO votes;")

        index_names = {row[1] for row in conn.exec_driver_sql("PRAGMA index_list(votes);")}
        if "uix_vote_voter_category" not in index_names:
            conn.exec_driver_sql(
                "CREATE UNIQUE INDEX IF NOT EXISTS uix_vote_voter_category ON votes (voter_id, category_id)"
            )


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Ensure any legacy local SQLite files are aligned before the app starts serving traffic.
ensure_sqlite_schema()
