.PHONY: default docker-config migration-run migration-generate seed-run

default:
	docker compose --env-file ./apps/api/.env up

docker-config:
	docker compose --env-file ./apps/api/.env config

migration-run:
	docker compose exec hq-api npm run migration:run

migration-generate:
	docker compose exec hq-api npm run migration:generate -- src/database/migrations/$(name)

seed-run:
	docker compose exec hq-api npm run seed:db