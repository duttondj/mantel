COMPOSE = docker compose -f docker-compose.yml

up:
	$(COMPOSE) up -d --build

down:
	$(COMPOSE) down

restart:
	$(COMPOSE) restart app

logs:
	$(COMPOSE) logs -f app

migrate:
	$(COMPOSE) exec app npm run db:migrate

seed:
	$(COMPOSE) exec app npm run db:seed

seed-demo:
	$(COMPOSE) exec app npm run seed:demo

purge:
	$(COMPOSE) exec app npm run purge

purge-commit:
	$(COMPOSE) exec app npm run purge -- --commit

remind:
	$(COMPOSE) exec app npm run remind

migrate-storage:
	$(COMPOSE) exec app npm run migrate:storage

migrate-storage-commit:
	$(COMPOSE) exec app npm run migrate:storage -- --commit

ps:
	$(COMPOSE) ps

.PHONY: up down restart logs migrate seed seed-demo purge purge-commit remind migrate-storage migrate-storage-commit ps
