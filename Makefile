.PHONY: setup dev build start docker down clean migrate studio check-types infra console

# ---------------------------------------------------------------------------
# Development
# ---------------------------------------------------------------------------

setup: ## Full local setup: install, env, infra, migrate, console
	@echo ">>> Installing gateway dependencies..."
	bun install
	@test -f .env || (cp .env.example .env && echo ">>> Created .env from .env.example — edit it with your keys")
	@echo ">>> Installing console dependencies..."
	cd console && npm install
	@echo ">>> Building console..."
	cd console && npm run build
	@echo ">>> Starting Postgres and Redis..."
	$(MAKE) infra
	@echo ">>> Waiting for Postgres to be ready..."
	@sleep 3
	@echo ">>> Running database migrations..."
	$(MAKE) migrate
	@echo ""
	@echo "Setup complete. Run 'make dev' to start the gateway."
	@echo "Console will be at http://localhost:4000/console"

dev: ## Start dev server with hot reload
	bun run dev

dev-console: ## Start console dev server (with HMR, proxied to gateway)
	cd console && npm run dev

build: console ## Production build (gateway + console)
	bun run build

start: ## Start production server (requires build first)
	bun run start

check-types: ## Run TypeScript type checking
	bun run check-types

# ---------------------------------------------------------------------------
# Console
# ---------------------------------------------------------------------------

console: ## Build the console SPA (output: public/console/)
	cd console && npm run build

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

migrate: ## Generate and apply database migrations
	bun run db:generate
	bun run db:migrate

studio: ## Open Drizzle Studio (database browser)
	bun run db:studio

# ---------------------------------------------------------------------------
# Infrastructure
# ---------------------------------------------------------------------------

infra: ## Start Postgres and Redis containers
	@docker run -d --name summoned-postgres -p 5432:5432 \
		-e POSTGRES_USER=summoned \
		-e POSTGRES_PASSWORD=summoned \
		-e POSTGRES_DB=summoned_gateway \
		postgres:16-alpine 2>/dev/null || true
	@docker run -d --name summoned-redis -p 6379:6379 \
		redis:7-alpine 2>/dev/null || true

infra-stop: ## Stop Postgres and Redis containers
	@docker stop summoned-postgres summoned-redis 2>/dev/null || true
	@docker rm summoned-postgres summoned-redis 2>/dev/null || true

# ---------------------------------------------------------------------------
# Docker Compose
# ---------------------------------------------------------------------------

docker: ## Build and start everything with Docker Compose
	docker compose up -d --build

down: ## Stop Docker Compose
	docker compose down

logs: ## Tail Docker Compose logs
	docker compose logs -f gateway

# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------

clean: ## Remove build artifacts
	rm -rf dist public/console node_modules/.cache *.tsbuildinfo

gen-admin-key: ## Generate a secure admin API key
	@openssl rand -hex 32

create-key: ## Create an API key (requires running gateway). Usage: make create-key NAME=mykey TENANT=default
	@curl -s -X POST http://localhost:4000/v1/keys \
		-H "x-admin-key: $$(grep ADMIN_API_KEY .env | cut -d= -f2)" \
		-H "Content-Type: application/json" \
		-d "{\"name\": \"$(or $(NAME),dev-key)\", \"tenantId\": \"$(or $(TENANT),default)\"}" | \
		python3 -m json.tool 2>/dev/null || bun -e "console.log('Install python3 or use curl directly')"

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-18s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
