# Book Club Awards

Full-stack demo that helps any book club collect votes for annual awards and compute weighted winners.

## Tech Stack
- **Backend:** FastAPI + SQLAlchemy (SQLite by default)
- **Frontend:** React (Vite, TypeScript)
- **Database:** SQLite file `bookclub.db` (configurable)

## Backend setup (`/backend`)
1. Create & activate a virtualenv (optional but recommended):
   ```bash
   cd backend
   python3 -m venv .venv
   source .venv/bin/activate
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Configure environment (optional):
   - `DATABASE_URL` (default `sqlite:///./bookclub.db`)
   - `ADMIN_SECRET` (default `letmein`)
   - `CORS_ORIGINS` (comma separated, defaults to `*`).
4. Launch the API:
   ```bash
   uvicorn main:app --reload
   ```
   > If running from the repository root, use `uvicorn backend.main:app --reload` instead.

The API automatically creates database tables on first run.

## Frontend setup (`/frontend`)
1. Install packages:
   ```bash
   cd frontend
   npm install
   ```
2. Optionally set the backend URL via `.env`:
   ```env
   VITE_API_BASE_URL=http://localhost:8000
   ```
   (Defaults to `http://localhost:8000`.)
3. Start the dev server:
   ```bash
   npm run dev
   ```

The React app provides:
- `/admin` for configuring clubs, books, categories, opening/closing voting, and viewing results.
- `/admin/:slug` for managing a specific club.
- `/club/:slug` public voting page for members.

## Basic usage flow
1. Visit the admin UI at `http://localhost:5173/admin`.
2. Enter the shared admin secret (match the backend `ADMIN_SECRET`).
3. Create a club (name + slug).
4. Inside the club page:
   - Add books with `readers_count` values.
   - Add categories with descriptions and sort order.
   - Keep voting open while members vote at `/club/{slug}`.
5. Share the voting link with members. They enter their name once and submit one vote per category (submissions overwrite previous picks per category).
6. When ready, close voting from the admin screen. View weighted results per category (votes divided by readers count, ties resolved by vote count).

## Notes
- Admin endpoints require the shared secret via `X-Admin-Secret` header; the frontend stores it in `localStorage`.
- Weighted results use `weighted_score = votes_count / readers_count` (0 if readers count is 0). Adjust the formula easily in `backend/crud.py`.
- SQLite is the default storage; swap `DATABASE_URL` for Postgres/MySQL if desired.
