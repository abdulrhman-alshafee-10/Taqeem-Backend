#!/usr/bin/env bash
set -euo pipefail

# Arguments: SERVICE (e.g. "review-service") and IMAGE_TAG (git SHA)
SERVICE=${1:?"Usage: deploy.sh <service> <tag>"}
IMAGE_TAG=${2:?}
COMPOSE_FILE="docker-compose.prod.yml"

echo "→ Deploying $SERVICE:$IMAGE_TAG"

# 1. Pull new image
docker compose -f $COMPOSE_FILE pull $SERVICE

# 2. Run any pending DB migrations before restarting the service
if [ -f "services/$SERVICE/prisma/schema.prisma" ]; then
  echo "→ Running Prisma migrations for $SERVICE"
  docker compose -f $COMPOSE_FILE run --rm --no-deps $SERVICE \
    npx prisma migrate deploy
fi

# 3. Restart the single service (zero other services affected)
# --no-deps: don't restart dependencies
# Docker Compose stops old container, starts new one from pulled image
docker compose -f $COMPOSE_FILE up -d --no-deps --force-recreate $SERVICE

# 4. Wait for the /readyz or /healthz probe to return 200
# The gateway is on 3000 and uses /healthz, while others are on their respective ports and use /readyz
# Instead of hardcoding ports, we can rely on docker compose health status if configured,
# but the script uses curl on localhost port. Let's get the port from docker compose port.
PORT=$(docker compose -f $COMPOSE_FILE port $SERVICE 4000 | cut -d: -f2 || echo "")
# For gateway, it might be port 3000
if [ -z "$PORT" ]; then
  PORT=$(docker compose -f $COMPOSE_FILE port $SERVICE 3000 | cut -d: -f2 || echo "")
fi

PROBE_PATH="/readyz"
if [ "$SERVICE" == "gateway" ]; then
  PROBE_PATH="/healthz"
fi

if [ -n "$PORT" ]; then
  echo "→ Waiting for $SERVICE readiness on port $PORT..."
  for i in $(seq 1 30); do
    if curl -sf http://localhost:$PORT$PROBE_PATH > /dev/null; then
      echo "→ $SERVICE is ready ✓"
      
      # Save the last stable tag for rollback
      echo "$IMAGE_TAG" > ".last_stable_tag_$SERVICE"
      exit 0
    fi
    sleep 2
  done

  echo "✗ $SERVICE did not become ready — rolling back"
  docker compose -f $COMPOSE_FILE stop $SERVICE
  
  PREV_TAG=$(cat .last_stable_tag_$SERVICE 2>/dev/null || echo "latest")
  echo "→ Restoring previous image tag: $PREV_TAG"
  IMAGE_TAG=$PREV_TAG docker compose -f $COMPOSE_FILE up -d --no-deps $SERVICE
  exit 1
else
  # If we can't find a mapped port, we just wait a bit and hope for the best (or rely on docker healthchecks)
  echo "→ No port mapping found for $SERVICE, skipping curl readiness check. Relying on Docker."
  # Save tag anyway
  echo "$IMAGE_TAG" > ".last_stable_tag_$SERVICE"
fi
