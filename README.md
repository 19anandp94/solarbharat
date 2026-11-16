# DGA Bharat Solar

A lightweight solar-installation landing page with lead capture and a phone-number portal for installation updates.

## Run locally

Start the API (uses SQLite locally unless `DATABASE_URL` is set to a PostgreSQL URL):

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
py -m pip install -r requirements.txt
py -m uvicorn app.main:app --reload --port 8000
```

Start the web app in another terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open the URL shown by Vite (normally `http://localhost:5173`). The API is proxied automatically.

## Production notes

- Set `DATABASE_URL=postgresql+psycopg://user:password@host/dbname`.
- Replace the development OTP response in `backend/app/main.py` with an SMS provider (for example Twilio or MSG91).
- Create a user/installation record through the API or database. A linked installation will appear after verification.

## Admin portal

Open `http://localhost:5173/admin` to view and manage enquiry leads. For local development, sign in with:

- Username: `admin`
- Password: `change-me-before-production`

Before deploying, set unique secrets in the environment rather than using the development values:

```powershell
$env:DGA_ADMIN_USERNAME = "your-admin-username"
$env:DGA_ADMIN_PASSWORD = "a-long-unique-password"
```

The admin session is protected by an API bearer token. Do not expose or reuse the development password in production.
