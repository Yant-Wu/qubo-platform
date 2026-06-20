# QUBO Optimization Platform

Monorepo containing the FastAPI backend, React dashboard, release deployment configuration, and image publishing tools.

## Deploy with Docker Compose

The deployment host needs Docker Compose, an NVIDIA GPU, and NVIDIA Container Toolkit. Download only the Compose file, then start the services:

```bash
curl -fsSLO https://raw.githubusercontent.com/Yant-Wu/qubo-platform/main/docker-compose.yml
docker compose up -d
```

This uses the latest published images. To update an existing deployment without deleting its persistent `qubo_data` volume:

```bash
docker compose pull
docker compose up -d
```

To pin a known release instead of using latest:

```bash
BACKEND_IMAGE_TAG=gpu-v1.0.0 FRONTEND_IMAGE_TAG=v1.0.0 docker compose up -d
```

## Publish images after a code change

First validate and commit your code, then authenticate to Docker Hub once per machine or session:

```bash
docker login
make publish VERSION=v1.0.0
```

The publish command builds the CUDA backend and dashboard for `linux/amd64`, then pushes both immutable version tags and the `latest` tags used by the default Compose deployment.

For a different registry or platform, set environment variables before the command:

```bash
PLATFORM=linux/arm64 BACKEND_REPOSITORY=example/qubo-backend \
FRONTEND_REPOSITORY=example/qubo-frontend \
./scripts/publish-images.sh v1.0.0
```

See [backend/README.md](backend/README.md) and [qubo-dashboard/README.md](qubo-dashboard/README.md) for development details.
