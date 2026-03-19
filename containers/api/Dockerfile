# ══════════════════════════════════════════════════════════════════
# OpenCERN API Container — with embedded C++ ROOT processor
# Uses ROOT image as base (has Python 3.x + all ROOT C++ libs)
# Triggering github action build 2
# ══════════════════════════════════════════════════════════════════

FROM --platform=linux/amd64 rootproject/root:6.32.02-ubuntu24.04

# Install build tools and Python pip
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    cmake \
    g++ \
    make \
    python3-pip \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# ── Build the C++ processor ──
WORKDIR /build
COPY containers/cpp-processor/CMakeLists.txt .
COPY containers/cpp-processor/src/ src/

RUN cmake -B build -DCMAKE_BUILD_TYPE=Release \
    && cmake --build build -j$(nproc) \
    && cmake --install build --prefix /usr/local \
    && rm -rf /build

# ── Set up the Python API ──
RUN useradd -m -o -u 1000 appuser 2>/dev/null || true
WORKDIR /app

RUN pip install --no-cache-dir --break-system-packages \
    fastapi uvicorn httpx requests pydantic python-multipart aiofiles

COPY containers/api/main.py containers/api/config.py containers/api/models.py ./
COPY containers/api/routers/ ./routers/
COPY containers/api/services/ ./services/

RUN chown -R appuser:appuser /app
USER appuser
ENV HOME=/home/appuser

EXPOSE 8080

HEALTHCHECK --interval=5s --timeout=3s --start-period=10s --retries=3 \
    CMD curl --fail http://localhost:8080/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
