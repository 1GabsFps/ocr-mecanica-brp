FROM python:3.12-alpine

WORKDIR /app

# Criar usuario nao privilegiado para seguranca do container
RUN addgroup -S appgroup && adduser -S appuser -G appgroup && \
    mkdir -p /app/data && \
    chown -R appuser:appgroup /app

COPY --chown=appuser:appgroup server.py /app/server.py

USER appuser

VOLUME ["/app/data"]

EXPOSE 8002

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8002/')" || exit 1

CMD ["python", "server.py"]
