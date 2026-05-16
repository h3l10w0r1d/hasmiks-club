# Hasmik's Club — Backend

FastAPI + PostgreSQL backend.

## Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# Edit .env with your actual DB credentials and secret key
```

## Database

Create the database in PostgreSQL:
```sql
CREATE DATABASE hasmiks_club;
```

Run migrations:
```bash
alembic upgrade head
```

## Run

```bash
uvicorn app.main:app --reload
```

API docs available at: http://localhost:8000/docs

## Endpoints

| Method | Path | Description |
|---|---|---|
| POST | /auth/register | Register new user |
| POST | /auth/login | Login (returns JWT) |
| GET | /members/me | Get own profile |
| PATCH | /members/me | Update profile |
| GET | /events/ | List all events |
| POST | /events/ | Create event |
| POST | /events/{id}/rsvp | RSVP to event |
| DELETE | /events/{id}/rsvp | Cancel RSVP |
| GET | /content/ | List all content |
| GET | /content/my/library | My unlocked content |
| POST | /content/ | Create content item |
| POST | /content/{id}/unlock/{user_id} | Unlock content for member |
