.PHONY: help install build up down restart logs clean test migrate seed

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

seed: ## Seed database with initial data
	@echo "Seeding database..."
	docker-compose exec backend python scripts/seed_data.py
	@echo "Seeding complete!"

shell-backend: ## Open backend shell
	docker-compose exec backend bash

shell-db: ## Open database shell
	docker-compose exec db psql -U kriterion -d kriterion

dev-backend: ## Run backend in development mode (outside Docker)
	cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

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
