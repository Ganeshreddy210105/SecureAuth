FROM python:3.11-slim

WORKDIR /workspace

# Install system dependencies needed for compiling python libraries if any (not strictly needed for psycopg2-binary, but good practice)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY alembic.ini .
COPY alembic/ ./alembic
COPY app/ ./app

EXPOSE 8000

# Run migrations and start uvicorn
CMD ["sh", "-c", "python -m alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
