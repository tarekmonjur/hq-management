.PHONY: default docker-config

default:
	docker compose --env-file ./apps/api/.env up

docker-config:
	docker compose --env-file ./apps/api/.env config