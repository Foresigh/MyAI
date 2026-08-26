#!/bin/bash
set -e

ollama serve &

echo "Waiting for Ollama to start..."
for i in $(seq 1 120); do
  if curl -sf http://localhost:11434/api/tags > /dev/null; then
    echo "Ollama is up."
    break
  fi
  if [ "$i" -eq 120 ]; then
    echo "Ollama did not start within 120 seconds. Exiting." >&2
    exit 1
  fi
  sleep 1
done

MODEL_NAME="${MODEL_NAME:-qwen3:8b}"
echo "Ensuring $MODEL_NAME is pulled (this can take a while on first boot)..."
ollama pull "$MODEL_NAME"

exec python3 -m uvicorn main:app --host 0.0.0.0 --port "${PORT:-8000}"
