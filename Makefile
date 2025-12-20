.PHONY: help prepare up build down down-v clean manu up-d nuke seed

# Variables
DOCKER_COMPOSE = sudo docker-compose
SERVICES_CORE = backend frontend
SERVICES_MONITORING = prometheus grafana node-exporter elasticsearch logstash kibana elasticsearch-setup

help:
	@echo "Commandes disponibles:"
	@echo "  make prepare   - Prépare l'environnement (place le .env à la racine)"
	@echo "  make up        - Lance tous les services avec rebuild + seed BDD automatique"
	@echo "  make up-d      - Lance tous les services en arrière-plan (sudo docker-compose up -d)"
	@echo "  make build     - Build tous les services sans les lancer"
	@echo "  make seed      - Remplit la base de données avec les données de test"
	@echo "  make down      - Arrête tous les services (sudo docker-compose down)"
	@echo "  make down-v    - Arrête tous les services et supprime les volumes (sudo docker-compose down -v)"
	@echo "  make clean     - Alias pour down-v"
	@echo "  make manu      - Build uniquement frontend et backend (sans monitoring)"
	@echo "  make nuke      - RESET COMPLET: arrête tout, supprime volumes/réseaux/images et prune le système"

# Prépare l'environnement (copie le .env depuis le home)
prepare:
	@if [ ! -f ~/.env ]; then \
		echo "Erreur: Fichier .env non trouvé dans le home directory"; \
		echo "Merci de placer le fichier .env dans ~/ ($(HOME))"; \
		exit 1; \
	fi
	@cp ~/.env .env
	@echo "✓ Fichier .env copié depuis $(HOME)/.env"
	@echo "✓ Environnement prêt pour le démarrage"

# Lance tous les services avec rebuild + seed automatique
# Lance tous les services avec rebuild + seed automatique
up:
	$(DOCKER_COMPOSE) up --build -d
	@until $(DOCKER_COMPOSE) exec -T backend node -e "process.exit(0)" 2>/dev/null; do \
		echo "Backend pas encore prêt, attente..."; \
		sleep 2; \
	done
	@make seed
	$(DOCKER_COMPOSE) logs -f

# Lance tous les services en arrière-plan
up-d:
	$(DOCKER_COMPOSE) up -d

# Build tous les services
build:
	$(DOCKER_COMPOSE) build

# Remplit la base de données avec des données de test
seed:
	@$(DOCKER_COMPOSE) exec -T backend npm run fillbdd

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