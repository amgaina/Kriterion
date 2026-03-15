.PHONY: help install build up down restart logs clean test migrate migrate-local seed seed-local reset-db

install: ## Install dependencies
	@echo "Installing backend dependencies..."
	cd backend && pip3 install -r requirements.txt
	@echo "Installing frontend dependencies..."
	cd frontend && npm install
	@echo "Dependencies installed successfully!"

build: ## Build Docker images
	@echo "Building Docker images..."
	docker-compose build
	@echo "Build complete!"

up: ## Start all services
	@echo "Starting Kriterion services..."
	docker-compose up -d

down: ## Stop all services
	@echo "Stopping services..."
	docker-compose down
	@echo "Services stopped!"

restart: down up ## Restart all services

logs: ## View logs
	docker-compose logs -f

logs-backend: ## View backend logs
	docker-compose logs -f backend

logs-frontend: ## View frontend logs
	docker-compose logs -f frontend

logs-celery: ## View Celery worker logs
	docker-compose logs -f celery_worker

logs-redis: ## View Redis logs
	docker-compose logs -f redis

celery-status: ## Check Celery worker status
	docker-compose exec celery_worker celery -A app.core.celery_app inspect active

celery-purge: ## Purge all Celery tasks
	docker-compose exec celery_worker celery -A app.core.celery_app purge

celery-restart: ## Restart Celery worker
	docker-compose restart celery_worker

clean: ## Clean up containers, volumes, and caches
	@echo "Cleaning up..."
	docker-compose down -v
	rm -rf backend/__pycache__
	rm -rf backend/app/__pycache__
	rm -rf frontend/.next
	rm -rf frontend/node_modules
	@echo "Cleanup complete!"

test-backend: ## Run backend tests
	cd backend && pytest

test-frontend: ## Run frontend tests
	cd frontend && npm test

migrate: ## Run database migrations
	@echo "Running migrations..."
	docker-compose exec backend alembic upgrade head
	@echo "Migrations complete!"

migrate-create: ## Create a new migration
	@read -p "Enter migration message: " msg; \
	docker-compose exec backend alembic revision --autogenerate -m "$$msg"

migrate-local: ## Run migrations against Supabase (local, no Docker; set DATABASE_URL in .env)
	@echo "Running migrations (local → Supabase)..."
	@if [ -d backend/.venv ]; then \
		cd backend && .venv/bin/alembic upgrade head; \
	else \
		cd backend && alembic upgrade head; \
	fi
	@echo "Migrations complete!"

seed: ## Seed database (Docker - requires backend container running)
	@echo "Seeding database..."
	docker-compose exec backend python scripts/seed_data.py
	@echo "Seeding complete!"

seed-local: ## Seed database locally (connects to Supabase, no Docker)
	@echo "Seeding database (local)..."
	@if [ -d backend/.venv ]; then \
		cd backend && .venv/bin/python scripts/seed_data.py; \
	else \
		cd backend && python3 scripts/seed_data.py; \
	fi
	@echo "Seeding complete!"

reset-db: ## Drop DB (public schema), run migrations, and seed (uses backend/.env or .env for DATABASE_URL)
	@echo "Step 1: Dropping public schema..."
	@if [ -d backend/.venv ]; then backend/.venv/bin/python backend/scripts/reset_schema.py; else python3 backend/scripts/reset_schema.py; fi
	@echo "Step 2: Running migrations..."
	@$(MAKE) migrate-local
	@echo "Step 3: Seeding..."
	@$(MAKE) seed-local
	@echo "Done. Database reset, migrated, and seeded."

shell-backend: ## Open backend shell
	docker-compose exec backend bash

shell-db: ## Open database shell
	docker-compose exec db psql -U kriterion -d kriterion

dev-backend: ## Run backend in development mode (outside Docker, uses venv if present)
	@if [ -d backend/.venv ]; then \
		cd backend && .venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000; \
	else \
		cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000; \
	fi

dev-frontend: ## Run frontend in development mode (outside Docker)
	cd frontend && npm run dev

setup: ## Initial setup (install, build, migrate, seed)
	@echo "Setting up Kriterion..."
	@cp .env.example .env
	@echo "⚠️  Please edit .env file with your configuration"
	@echo "Then run: make build && make up && make migrate && make seed"

init-db: migrate seed ## Initialize database (migrate + seed)

status: ## Show service status
	docker-compose ps

sandbox-build: ## Build sandbox container
	docker build -t kriterion-sandbox:latest ./sandbox
