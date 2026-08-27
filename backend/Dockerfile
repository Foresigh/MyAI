FROM ollama/ollama:latest

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip3 install --break-system-packages --no-cache-dir -r requirements.txt

COPY . .
RUN chmod +x start.sh

ENV OLLAMA_URL=http://localhost:11434
ENV MODEL_NAME=qwen3:8b

EXPOSE 8000

ENTRYPOINT ["./start.sh"]
