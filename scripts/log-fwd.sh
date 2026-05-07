#!/bin/sh
# Forward gateway NDJSON audit events to the dashboard ingest endpoint.
# Sources: docker | file | stdin
set -e

SERVER="${AUDIT_SERVER_URL:-http://localhost:3000}"
SECRET="${AUDIT_INGEST_SECRET:-dev-ingest-secret}"
SOURCE="${GATEWAY_LOG_SOURCE:-file}"
CONTAINER_NAME="${GATEWAY_CONTAINER_NAME:-promptshield-gateway}"
LOG_FILE="${GATEWAY_LOG_FILE:-./gateway-logs/promptshield.log}"

forward_line() {
  line="$1"
  # Accept raw JSON or prefixed lines containing a JSON object.
  json="$(printf '%s' "$line" | sed -n 's/^[^{]*\({.*\)$/\1/p')"
  if [ -z "$json" ]; then
    return 0
  fi

  if wget -qO- \
    --post-data="$json" \
    --header="Content-Type: text/plain" \
    --header="x-ingest-secret: $SECRET" \
    "$SERVER/internal/audit/ingest" > /dev/null 2>&1; then
    echo "[forward_line] forwarded audit event" >&2
  else
    echo "[forward_line] failed to forward audit event" >&2
  fi
}

forward_stream() {
  while IFS= read -r line; do
    forward_line "$line"
  done
}

echo "log-fwd: waiting for server at $SERVER..."
tries=0
until wget -qO- "$SERVER/" > /dev/null 2>&1; do
  tries=$((tries + 1))
  if [ $tries -gt 30 ]; then
    echo "log-fwd: ERROR: server at $SERVER did not become ready after 60s"
    exit 1
  fi
  sleep 2
done
echo "log-fwd: server ready, starting to forward logs"

case "$SOURCE" in
  docker)
    echo "log-fwd: source=docker container=$CONTAINER_NAME"

    # Check docker access before waiting.
    if ! docker version --format '{{.Server.Version}}' >/dev/null 2>&1; then
      echo "log-fwd: ERROR: cannot reach docker daemon — is /var/run/docker.sock mounted?" >&2
      exit 1
    fi

    # Wait for the container; otherwise `docker logs` exits 0 and we restart-loop.
    waited=0
    last_state=""
    while true; do
      state="$(docker inspect -f '{{.State.Status}}' "$CONTAINER_NAME" 2>/dev/null || echo missing)"
      if [ "$state" = "running" ]; then break; fi

      if [ $waited -gt 120 ]; then
        echo "log-fwd: ERROR: container '$CONTAINER_NAME' not running after 120s (last state: $state)" >&2
        if [ "$state" = "missing" ]; then
          echo "log-fwd: hint: the gateway service isn't started. Bring it up with:" >&2
          echo "         docker compose -f docker-compose.dev.yml up -d gateway" >&2
        fi
        exit 1
      fi
      # Log only on state changes to avoid spam.
      if [ "$state" != "$last_state" ]; then
        echo "log-fwd: waiting for container '$CONTAINER_NAME' (state=$state)..."
        last_state="$state"
      fi
      waited=$((waited + 2))
      sleep 2
    done
    echo "log-fwd: container '$CONTAINER_NAME' is running, attaching to logs"

    docker logs --tail 0 -f "$CONTAINER_NAME" | forward_stream
    rc=$?
    echo "log-fwd: docker logs stream ended (rc=$rc) for container=$CONTAINER_NAME" >&2
    # Exit non-zero so restart policy re-waits for the container.
    exit "${rc:-1}"
    ;;
  file)
    echo "log-fwd: source=file path=$LOG_FILE"
    touch "$LOG_FILE"
    if ! tail -n 0 -F "$LOG_FILE" 2>/dev/null | forward_stream; then
      echo "log-fwd: ERROR: tail failed for path=$LOG_FILE"
      exit 1
    fi
    ;;
  stdin)
    echo "log-fwd: source=stdin"
    forward_stream
    ;;
  *)
    echo "log-fwd: ERROR: unsupported GATEWAY_LOG_SOURCE=$SOURCE (expected: docker|file|stdin)"
    exit 1
    ;;
esac

