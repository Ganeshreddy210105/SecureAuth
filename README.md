# SecureAuth

SecureAuth is a production-grade, enterprise identity provider and authentication platform featuring a premium, Apple-quality glassmorphism UI. Built with a robust FastAPI backend and a Next.js 15 frontend, it secures applications using industry-standard JWT rotation, passwordless workflows, and social logins.

---

## Technical Architecture

SecureAuth employs a split-service architecture optimized for speed, reliability, and security:

```
[ Next.js 15 Client ] <---> [ FastAPI Gateway ] <---> [ PostgreSQL ]
       (3D Particles)            (HS256 JWTs)            (Users & Sessions)
                                     |
                                     +--------------> [ Redis Cache ]
                                                         (OTPs & Blacklist)
                                     |
                                     +--------------> [ Mailhog Server ]
                                                         (Local Inbox UI)
```

### Key Security Implementations:
1. **Argon2 Hashing**: Standard password validation utilizing high-entropy memory-hard cryptographic salts.
2. **Access Token Short-TTL**: Access tokens expire in 15 minutes, with short-lived tokens protecting paths from exposure.
3. **Automatic Rotation (RTR)**: Refresh tokens expire in 7 days. Every token refresh request revokes the previous token and issues a new pair.
4. **Token Theft Detection**: In the event of an old refresh token reuse attempt, the system assumes theft has occurred, invalidating all active sessions for that user instantly.
5. **Redis Access Blacklisting**: On logout, the client's current access token is blacklisted in Redis until its remaining TTL expires.

---

## Tech Stack

* **Frontend**: Next.js 15 (App Router), React 19, TypeScript, TailwindCSS v4, Framer Motion, React Three Fiber (Three.js), TanStack Query, Axios, Sonner, React Hook Form, Zod.
* **Backend**: FastAPI, SQLAlchemy 2.0 (PostgreSQL), Redis, Alembic migrations, Pytest, FastAPI-Mail, Argon2 password hashing, PyJWT.
* **Infrastructure**: Docker & Docker Compose, GitHub Actions CI.

---

## Project Folder Structure

```
secureauth/
├── backend/
│   ├── app/
│   │   ├── api/        # Endpoint routers (auth, user, oauth)
│   │   ├── auth/       # OAuth handlers (Google, GitHub)
│   │   ├── core/       # Security (Argon2, JWT) & Config settings
│   │   ├── database/   # SQL connection & sessions
│   │   ├── models/     # SQLAlchemy models (User, RefreshToken)
│   │   ├── schemas/    # Pydantic v2 validation models
│   │   ├── services/   # SMTP email helper & Redis cache
│   │   ├── tests/      # Automated pytest suites
│   │   └── main.py     # Application root & Middleware headers
│   ├── alembic/        # Alembic database migrations
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── app/            # App Router pages (Login, Register, Dashboard, etc.)
│   ├── components/     # Background3D and floating Navbar components
│   ├── lib/            # Axios client with automated rotation interceptors
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
└── .env.example
```

---

## Getting Started

### Prerequisites
Make sure you have [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/) installed on your machine.

### Quick Start (Docker)
1. **Clone & Configure**: Copy the environment template:
   ```bash
   cp .env.example .env
   ```
2. **Build and Run**: Start the entire multi-container registry with one command:
   ```bash
   docker-compose up --build
   ```
3. **Access Services**:
   * **Frontend Application**: `http://localhost:3000`
   * **FastAPI Backend (docs)**: `http://localhost:8000/docs`
   * **Mailhog Web UI**: `http://localhost:8025` (Open this to view verification codes sent locally!)

---

## API Endpoints Reference

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| **POST** | `/api/v1/auth/register` | Create account & send verification code | No |
| **POST** | `/api/v1/auth/login` | Authenticate email/password, set cookies | No |
| **POST** | `/api/v1/auth/verify-email` | Validate 6-digit email confirmation code | No |
| **POST** | `/api/v1/auth/resend-verification` | Resend email code with 60s cooldown limit | No |
| **POST** | `/api/v1/auth/refresh` | Rotate access + refresh tokens | No (Cookie) |
| **POST** | `/api/v1/auth/send-otp` | Request passwordless OTP login code | No |
| **POST** | `/api/v1/auth/login-otp` | Validate code and log in | No |
| **GET** | `/api/v1/auth/google/login` | Redirect to Google OAuth screen | No |
| **GET** | `/api/v1/auth/github/login` | Redirect to GitHub OAuth screen | No |
| **POST** | `/api/v1/auth/logout` | Revoke active refresh & blacklist access | Yes |
| **GET** | `/api/v1/users/me` | Fetch active user information | Yes |
| **PUT** | `/api/v1/users/profile` | Update display name and avatar details | Yes |
| **PUT** | `/api/v1/users/change-password` | Update standard account password | Yes |
| **GET** | `/api/v1/users/sessions` | Fetch device log audit details | Yes |
| **DELETE** | `/api/v1/users/sessions/:id` | Revoke session / Logout specific device | Yes |
| **DELETE** | `/api/v1/users/sessions` | Revoke all sessions (except current) | Yes |
| **DELETE** | `/api/v1/users/me` | Delete account and cascade wipe records | Yes |

---

## Development & Test Commands

If you want to run the services individually for development:

### Backend Development:
```bash
cd backend
python -m pip install -r requirements.txt
python -m pytest   # Run unit test suite
uvicorn app.main:app --reload
```

### Frontend Development:
```bash
cd frontend
npm install --legacy-peer-deps
npm run dev
```
