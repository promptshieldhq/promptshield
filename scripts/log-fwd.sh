#!/bin/sh
# Forwards proxy NDJSON audit events to the dashboard ingest endpoint.
# Supported sources:
# - docker: tail docker logs for a container
# - file:   tail a host-mounted log file
# - stdin:  read log lines from stdin
set -e

SERVER="${AUDIT_SERVER_URL:-http://ps-server:3000}"
SECRET="${AUDIT_INGEST_SECRET:-dev-ingest-secret}"
SOURCE="${PROXY_LOG_SOURCE:-docker}"
CONTAINER_NAME="${PROXY_CONTAINER_NAME:-promptshield-gateway}"
LOG_FILE="${PROXY_LOG_FILE:-/proxy-logs/promptshield.log}"

forward_line() {
  line="$1"
  # Accept either raw JSON lines or prefixed logs that contain a JSON object.
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
    if ! docker logs -f "$CONTAINER_NAME" 2>/dev/null | forward_stream; then
      echo "log-fwd: ERROR: docker logs failed for container=$CONTAINER_NAME"
      exit 1
    fi
    ;;
  file)
    echo "log-fwd: source=file path=$LOG_FILE"
    touch "$LOG_FILE"
    if ! tail -F "$LOG_FILE" 2>/dev/null | forward_stream; then
      echo "log-fwd: ERROR: tail failed for path=$LOG_FILE"
      exit 1
    fi
    ;;
  stdin)
    echo "log-fwd: source=stdin"
    forward_stream
    ;;
  *)
    echo "log-fwd: ERROR: unsupported PROXY_LOG_SOURCE=$SOURCE (expected: docker|file|stdin)"
    exit 1
    ;;
esac

