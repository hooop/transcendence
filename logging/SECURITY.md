# Sécurité de la Stack ELK (Elasticsearch, Logstash, Kibana)

## Mesures de sécurité implémentées

### 1. Restriction d'accès réseau

**Elasticsearch** et **Kibana** ne sont accessibles que depuis `localhost` (127.0.0.1) :

- **Elasticsearch** : http://127.0.0.1:9200
- **Kibana** : http://127.0.0.1:5601

Cela signifie que ces services ne sont **PAS accessibles depuis l'extérieur** de la machine hôte.

### 2. Isolation réseau

Tous les composants ELK communiquent via un réseau Docker interne (`transcendence_network`), isolé du réseau public.

### 3. Configuration dans docker-compose.yml

```yaml
# Elasticsearch - Accès local uniquement
ports:
  - "127.0.0.1:9200:9200"  # Accessible uniquement en local

# Kibana - Accès local uniquement
ports:
  - "127.0.0.1:5601:5601"  # Accessible uniquement en local
```

## Accès aux services

### Sur la machine hôte

Depuis votre machine locale, vous pouvez accéder à :

- **Elasticsearch API** : http://localhost:9200
- **Kibana UI** : http://localhost:5601

### Depuis l'extérieur (SSH Tunnel)

Si vous avez besoin d'accéder à Kibana depuis une machine distante, utilisez un tunnel SSH :

```bash
ssh -L 5601:localhost:5601 user@votre-serveur
```

Puis ouvrez http://localhost:5601 dans votre navigateur local.

## Bonnes pratiques additionnelles

### Pour une sécurité renforcée en production

1. **Activer l'authentification** :
   - Mettre `xpack.security.enabled=true` dans Elasticsearch
   - Configurer des utilisateurs et mots de passe

2. **Utiliser HTTPS** :
   - Activer TLS pour Elasticsearch
   - Activer HTTPS pour Kibana

3. **Pare-feu** :
   - S'assurer que les ports 9200 et 5601 sont bloqués au niveau du pare-feu
   - Seuls les services internes Docker doivent y accéder

4. **Rotation des données** :
   - La politique ILM (Index Lifecycle Management) est déjà configurée
   - Les logs sont supprimés automatiquement après 90 jours

## Architecture de sécurité actuelle

```
Internet  ❌ Bloqué
    │
    ▼
[Pare-feu local]
    │
    ▼
127.0.0.1:9200  ← Elasticsearch (accessible localement uniquement)
127.0.0.1:5601  ← Kibana (accessible localement uniquement)
    │
    ▼
[Réseau Docker interne: transcendence_network]
    │
    ├── Logstash ✓
    ├── Backend ✓
    └── Autres services ✓
```

## Vérification de la sécurité

Pour vérifier que les ports ne sont pas exposés publiquement :

```bash
# Sur la machine hôte
netstat -tlnp | grep -E '(9200|5601)'

# Vous devriez voir 127.0.0.1:9200 et 127.0.0.1:5601
# PAS 0.0.0.0:9200 ou 0.0.0.0:5601
```

## Notes importantes

- ✅ Les données ELK sont sécurisées par isolation réseau
- ✅ Accès local uniquement (127.0.0.1)
- ✅ Réseau Docker interne pour la communication entre services
- ⚠️  Pour un environnement de production critique, envisager d'activer l'authentification xpack
