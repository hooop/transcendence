.PHONY: help up build down down-v clean manu up-d nuke

# Variables
DOCKER_COMPOSE = sudo docker-compose
SERVICES_CORE = backend frontend
SERVICES_MONITORING = prometheus grafana node-exporter elasticsearch logstash kibana elasticsearch-setup

help:
	@echo "Commandes disponibles:"
	@echo "  make up        - Lance tous les services avec rebuild (sudo docker-compose up --build)"
	@echo "  make up-d      - Lance tous les services en arrière-plan (sudo docker-compose up -d)"
	@echo "  make build     - Build tous les services sans les lancer"
	@echo "  make down      - Arrête tous les services (sudo docker-compose down)"
	@echo "  make down-v    - Arrête tous les services et supprime les volumes (sudo docker-compose down -v)"
	@echo "  make clean     - Alias pour down-v"
	@echo "  make manu      - Build uniquement frontend et backend (sans monitoring)"
	@echo "  make nuke      - RESET COMPLET: arrête tout, supprime volumes/réseaux/images et prune le système"

# Lance tous les services avec rebuild
up:
	$(DOCKER_COMPOSE) up --build

# Lance tous les services en arrière-plan
up-d:
	$(DOCKER_COMPOSE) up -d

# Build tous les services
build:
	$(DOCKER_COMPOSE) build

# Arrête tous les services
down:
	$(DOCKER_COMPOSE) down

# Arrête tous les services et supprime les volumes
down-v:
	$(DOCKER_COMPOSE) down -v

# Alias pour down-v
clean: down-v

# Build uniquement frontend et backend (sans monitoring)
manu:
	@echo "Building frontend and backend only (no monitoring services)..."
	$(DOCKER_COMPOSE) build $(SERVICES_CORE)
	@echo "Build complete! Use 'make up-d' or 'make up' to start services."

# NUKE - Reset complet de tous les conteneurs Docker
nuke:
	@echo "NUCLEAR OPTION - Resetting everything..."
	@echo "Stopping all containers..."
	-$(DOCKER_COMPOSE) down -v --remove-orphans
	@echo "Removing all project containers..."
	-sudo docker ps -a --filter "name=ft_transcendence" -q | xargs -r sudo docker rm -f
	@echo "Removing all project images..."
	-sudo docker images --filter "reference=transcendence*" -q | xargs -r sudo docker rmi -f
	@echo "Pruning all unused containers..."
	-sudo docker container prune -f
	@echo "Pruning all unused images..."
	-sudo docker image prune -a -f
	@echo "Pruning all unused volumes..."
	-sudo docker volume prune -f
	@echo "Pruning all unused networks..."
	-sudo docker network prune -f
	@echo "Pruning system (build cache, etc.)..."
	-sudo docker system prune -a -f --volumes
	@echo "Nuclear cleanup complete! Everything has been reset."
