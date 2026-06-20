COMPOSE = docker compose -f docker-compose.yml -f docker-compose.tunnel.yml

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

purge:
	$(COMPOSE) exec app npm run purge

purge-commit:
	$(COMPOSE) exec app npm run purge -- --commit

seed-demo:
	$(COMPOSE) exec app npm run seed:demo

remind:
	$(COMPOSE) exec app npm run remind

ps:
	$(COMPOSE) ps

.PHONY: up down restart logs migrate seed seed-demo purge purge-commit remind ps
