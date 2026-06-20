#!/usr/bin/env sh
# Build and publish the backend and frontend images for one release.
set -eu

VERSION=${1:-}
if [ -z "$VERSION" ]; then
  echo "Usage: $0 <version>" >&2
  echo "Example: $0 v1.0.0" >&2
  exit 64
fi

case "$VERSION" in
  *[!A-Za-z0-9._-]* | '')
    echo "Version may contain only letters, numbers, dots, underscores, and hyphens." >&2
    exit 64
    ;;
esac

ROOT_DIR=$(CDPATH= cd "$(dirname "$0")/.." && pwd)
PLATFORM=${PLATFORM:-linux/amd64}
BACKEND_REPOSITORY=${BACKEND_REPOSITORY:-yantwu/qubo-backend}
FRONTEND_REPOSITORY=${FRONTEND_REPOSITORY:-yantwu/qubo-frontend}

echo "Publishing version $VERSION for $PLATFORM"

docker buildx build \
  --platform "$PLATFORM" \
  -f "$ROOT_DIR/backend/Dockerfile.cuda" \
  -t "$BACKEND_REPOSITORY:gpu-$VERSION" \
  -t "$BACKEND_REPOSITORY:gpu-latest" \
  "$ROOT_DIR/backend" \
  --push

docker buildx build \
  --platform "$PLATFORM" \
  -t "$FRONTEND_REPOSITORY:$VERSION" \
  -t "$FRONTEND_REPOSITORY:latest" \
  "$ROOT_DIR/qubo-dashboard" \
  --push

cat <<EOF

Published:
  $BACKEND_REPOSITORY:gpu-$VERSION
  $BACKEND_REPOSITORY:gpu-latest
  $FRONTEND_REPOSITORY:$VERSION
  $FRONTEND_REPOSITORY:latest

Deploy the pinned release with:
  BACKEND_IMAGE_TAG=gpu-$VERSION FRONTEND_IMAGE_TAG=$VERSION docker compose up -d
EOF
