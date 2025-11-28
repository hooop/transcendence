#!/bin/bash

# Script d'initialisation de la politique ILM pour transcendence
# Ce script attend qu'Elasticsearch soit prêt, puis configure la politique ILM et le template d'index

set -e

ELASTICSEARCH_HOST="${ELASTICSEARCH_HOST:-http://elasticsearch:9200}"
ELASTIC_USER="${ELASTIC_USER:-elastic}"
ELASTIC_PASSWORD="${ELASTIC_PASSWORD:-transcendence_elk_2024}"
MAX_RETRIES=30
RETRY_INTERVAL=2

echo "🔍 Attente de la disponibilité d'Elasticsearch sur $ELASTICSEARCH_HOST..."

# Attendre qu'Elasticsearch soit prêt
for i in $(seq 1 $MAX_RETRIES); do
  if curl -s -u "$ELASTIC_USER:$ELASTIC_PASSWORD" "$ELASTICSEARCH_HOST" > /dev/null 2>&1; then
    echo "✅ Elasticsearch est disponible!"
    break
  fi

  if [ $i -eq $MAX_RETRIES ]; then
    echo "❌ Timeout: Elasticsearch n'est pas disponible après $MAX_RETRIES tentatives"
    exit 1
  fi

  echo "⏳ Tentative $i/$MAX_RETRIES - Elasticsearch n'est pas encore prêt, nouvelle tentative dans ${RETRY_INTERVAL}s..."
  sleep $RETRY_INTERVAL
done

echo ""
echo "📋 Configuration de la politique ILM 'transcendence-logs-policy'..."

# Créer la politique ILM
RESPONSE=$(curl -s -w "\n%{http_code}" -u "$ELASTIC_USER:$ELASTIC_PASSWORD" -X PUT "$ELASTICSEARCH_HOST/_ilm/policy/transcendence-logs-policy" \
  -H 'Content-Type: application/json' \
  -d @/setup/ilm-policy.json)

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 201 ]; then
  echo "✅ Politique ILM créée avec succès"
else
  echo "⚠️  Erreur lors de la création de la politique ILM (HTTP $HTTP_CODE)"
  echo "$BODY"
fi

echo ""
echo "📝 Configuration du template d'index 'transcendence-logs-template'..."

# Créer le template d'index
RESPONSE=$(curl -s -w "\n%{http_code}" -u "$ELASTIC_USER:$ELASTIC_PASSWORD" -X PUT "$ELASTICSEARCH_HOST/_index_template/transcendence-logs-template" \
  -H 'Content-Type: application/json' \
  -d @/setup/index-template.json)

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 201 ]; then
  echo "✅ Template d'index créé avec succès"
else
  echo "⚠️  Erreur lors de la création du template d'index (HTTP $HTTP_CODE)"
  echo "$BODY"
fi

echo ""
echo "🔄 Vérification de la configuration ILM..."

# Vérifier que la politique existe
curl -s -u "$ELASTIC_USER:$ELASTIC_PASSWORD" "$ELASTICSEARCH_HOST/_ilm/policy/transcendence-logs-policy" | grep -q "transcendence-logs-policy"
if [ $? -eq 0 ]; then
  echo "✅ Politique ILM vérifiée"
else
  echo "❌ La politique ILM n'a pas pu être vérifiée"
  exit 1
fi

# Vérifier que le template existe
curl -s -u "$ELASTIC_USER:$ELASTIC_PASSWORD" "$ELASTICSEARCH_HOST/_index_template/transcendence-logs-template" | grep -q "transcendence-logs-template"
if [ $? -eq 0 ]; then
  echo "✅ Template d'index vérifié"
else
  echo "❌ Le template d'index n'a pas pu être vérifié"
  exit 1
fi

echo ""
echo "👤 Création de l'utilisateur Kibana..."

# Créer l'utilisateur kibana_user pour Kibana (au lieu d'utiliser le superuser elastic)
# Utiliser curl pour appeler l'API Elasticsearch directement
RESPONSE=$(curl -s -w "\n%{http_code}" -u "$ELASTIC_USER:$ELASTIC_PASSWORD" -X POST "$ELASTICSEARCH_HOST/_security/user/kibana_user" \
  -H 'Content-Type: application/json' \
  -d '{"password":"elasticsearch","roles":["kibana_system"]}')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 201 ]; then
  echo "✅ Utilisateur kibana_user créé avec succès"
elif echo "$BODY" | grep -q "user already exists"; then
  echo "ℹ️  Utilisateur kibana_user existe déjà"
else
  echo "⚠️  Erreur lors de la création de l'utilisateur (HTTP $HTTP_CODE)"
  echo "$BODY"
fi

echo ""
echo "🎉 Configuration ILM terminée avec succès!"
echo ""
echo "📊 Résumé de la politique:"
echo "  - Hot phase: Rollover après 7 jours ou 10GB"
echo "  - Warm phase: Optimisation après 7 jours (forcemerge + shrink)"
echo "  - Delete phase: Suppression après 90 jours"
echo ""
echo "Les nouveaux indices 'transcendence-logs-*' utiliseront automatiquement cette politique."
