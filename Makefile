COMPOSE = docker compose --env-file ./apps/api/.env

.PHONY: default help up build down restart logs ps docker-config api-shell db-shell \
	migration-run migration-show migration-revert migration-generate seed-run

default: up

help:
	@printf '%s\n' \
		'Available commands:' \
		'  make / make up                  Build and start the development stack' \
		'  make build                      Build service images' \
		'  make down                       Stop services' \
		'  make restart [service=hq-api]   Restart services or one service' \
		'  make logs [service=hq-api]      Follow logs for all or one service' \
		'  make ps                         Show service status' \
		'  make docker-config              Validate and print Compose config' \
		'  make api-shell                  Open a shell in the API container' \
		'  make db-shell                   Open a PostgreSQL prompt' \
		'  make migration-run              Apply pending database migrations' \
		'  make migration-show             Show migration status' \
		'  make migration-revert           Revert the latest migration' \
		'  make migration-generate name=NAME Generate a migration from entity changes' \
		'  make seed-run                   Load development/demo seed data'

up:
	$(COMPOSE) up

up-build:
	$(COMPOSE) up --build

build:
	$(COMPOSE) build

down:
	$(COMPOSE) down

restart:
	$(COMPOSE) restart $(service)

logs:
	$(COMPOSE) logs --follow $(service)

ps:
	$(COMPOSE) ps

docker-config:
	$(COMPOSE) config

api-shell:
	$(COMPOSE) exec hq-api sh

db-shell:
	$(COMPOSE) exec hq-db sh -c 'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"'

migration-run:
	$(COMPOSE) exec hq-api npm run migration:run

migration-show:
	$(COMPOSE) exec hq-api npm run migration:show

migration-revert:
	$(COMPOSE) exec hq-api npm run migration:revert

migration-generate:
	@test -n "$(name)" || { echo "Usage: make migration-generate name=AddNewTable" >&2; exit 2; }
	$(COMPOSE) exec hq-api npm run migration:generate -- src/database/migrations/$(name)

seed-run:
	$(COMPOSE) exec hq-api npm run seed:db
