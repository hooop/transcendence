#!/bin/bash

# Script de génération de logs de test pour ELK
# Usage: ./fake-logs.sh [nombre_de_logs]

set -e

LOGSTASH_HOST="${LOGSTASH_HOST:-localhost}"
LOGSTASH_PORT="${LOGSTASH_PORT:-5000}"
NUM_LOGS="${1:-10}"

# Couleurs pour l'affichage
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Tableaux de données pour générer des logs variés
SERVICES=("backend" "frontend" "auth" "database" "api" "websocket")
LEVELS=("info" "warn" "error" "debug")
USERS=("alice" "bob" "charlie" "diana" "eve")
ACTIONS=("login" "logout" "create_game" "join_game" "send_message" "update_profile")
MESSAGES=(
  "User authenticated successfully"
  "Database query executed"
  "WebSocket connection established"
  "API request processed"
  "Cache hit for key"
  "Session created"
  "Token validated"
  "Game state updated"
  "Message delivered"
  "Profile updated successfully"
  "Authentication failed - invalid credentials"
  "Database connection timeout"
  "Rate limit exceeded"
  "WebSocket disconnected"
  "Invalid request payload"
)

HTTP_METHODS=("GET" "POST" "PUT" "DELETE" "PATCH")
HTTP_URLS=("/api/users" "/api/games" "/api/auth/login" "/api/auth/logout" "/api/messages" "/api/profile")
HTTP_STATUS=(200 201 400 401 403 404 500 503)

echo -e "${BLUE}=== Générateur de logs de test pour ELK ===${NC}"
echo -e "${BLUE}Envoi de ${NUM_LOGS} logs vers ${LOGSTASH_HOST}:${LOGSTASH_PORT}${NC}\n"

# Fonction pour générer un log aléatoire
generate_log() {
  local service="${SERVICES[$RANDOM % ${#SERVICES[@]}]}"
  local level="${LEVELS[$RANDOM % ${#LEVELS[@]}]}"
  local user="${USERS[$RANDOM % ${#USERS[@]}]}"
  local action="${ACTIONS[$RANDOM % ${#ACTIONS[@]}]}"
  local message="${MESSAGES[$RANDOM % ${#MESSAGES[@]}]}"
  local http_method="${HTTP_METHODS[$RANDOM % ${#HTTP_METHODS[@]}]}"
  local http_url="${HTTP_URLS[$RANDOM % ${#HTTP_URLS[@]}]}"
  local http_status="${HTTP_STATUS[$RANDOM % ${#HTTP_STATUS[@]}]}"
  local response_time=$((RANDOM % 500 + 10))

  # Créer un objet JSON avec des champs variés
  cat <<EOF
{
  "message": "${message}",
  "level": "${level}",
  "service": "${service}",
  "user": "${user}",
  "action": "${action}",
  "timestamp": "$(date -Iseconds)",
  "req": {
    "method": "${http_method}",
    "url": "${http_url}"
  },
  "res": {
    "statusCode": ${http_status}
  },
  "responseTime": ${response_time},
  "environment": "test",
  "version": "1.0.0"
}
EOF
}

# Compteurs pour les statistiques
success_count=0
error_count=0

# Envoi des logs
for i in $(seq 1 $NUM_LOGS); do
  log_data=$(generate_log)

  # Extraire le level pour l'affichage coloré
  level=$(echo "$log_data" | grep -o '"level": "[^"]*"' | cut -d'"' -f4)
  service=$(echo "$log_data" | grep -o '"service": "[^"]*"' | cut -d'"' -f4)
  message=$(echo "$log_data" | grep -o '"message": "[^"]*"' | cut -d'"' -f4)

  # Couleur selon le niveau
  case $level in
    error)
      color=$RED
      ;;
    warn)
      color=$YELLOW
      ;;
    info)
      color=$GREEN
      ;;
    *)
      color=$NC
      ;;
  esac

  # Envoyer le log à Logstash
  if printf '%s\n' "$log_data" | nc -w 1 $LOGSTASH_HOST $LOGSTASH_PORT > /dev/null 2>&1; then
    echo -e "${color}[${i}/${NUM_LOGS}] ${level} - ${service}: ${message}${NC}"
    success_count=$((success_count + 1))
  else
    echo -e "${RED}[${i}/${NUM_LOGS}] Erreur lors de l'envoi du log${NC}"
    error_count=$((error_count + 1))
  fi

  # Petit délai pour ne pas surcharger
  sleep 0.1
done

echo -e "\n${BLUE}=== Résumé ===${NC}"
echo -e "${GREEN}✓ Logs envoyés avec succès: ${success_count}${NC}"
if [ $error_count -gt 0 ]; then
  echo -e "${RED}✗ Logs en erreur: ${error_count}${NC}"
fi
echo -e "\n${BLUE}Attente de 3 secondes pour l'indexation...${NC}"
sleep 3

echo -e "${GREEN}Terminé! Kibana: http://localhost:5601${NC}"
echo -e "${BLUE}Login: elastic / transcendence_elk_2024${NC}"
