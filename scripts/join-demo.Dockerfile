# The Audience Node as a container, for laptops without Python, uv or pnpm (Windows especially).
# Build from the repo root: docker build -f scripts/join-demo.Dockerfile -t storm-shield-join .
# Run: see scripts/join-demo.md.
FROM node:22-slim AS dashboard
WORKDIR /build/dashboard
RUN corepack enable
COPY dashboard/package.json dashboard/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY dashboard/ ./
RUN pnpm build

FROM python:3.12-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl lsof \
  && rm -rf /var/lib/apt/lists/* \
  && pip install --no-cache-dir uv
WORKDIR /app
COPY node/pyproject.toml node/uv.lock node/README.md ./node/
COPY node/src ./node/src
RUN cd node && uv sync --frozen --no-dev
COPY --from=dashboard /build/dashboard/dist ./dashboard/dist
COPY scripts/join-demo.sh ./scripts/join-demo.sh

# Docker Desktop's network is NAT behind a VM, so Wi-Fi discovery cannot cross it: dial the Hub.
# On Linux, `--network host` with JOIN_MESH=auto finds the Hub by Wi-Fi discovery instead.
ENV JOIN_MESH=tcp JOIN_DIR=/data
VOLUME /data
ENTRYPOINT ["scripts/join-demo.sh"]
