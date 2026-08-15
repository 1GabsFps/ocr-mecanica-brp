import json
import sqlite3
import time
import os
import threading
import datetime
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler

DB_PATH = os.environ.get('DB_PATH', '/app/data/telemetry.db')
BRT_TZ = datetime.timezone(datetime.timedelta(hours=-3))

def get_operational_day_start_ms():
    """Retorna o timestamp (ms) do início do turno operacional atual (03:00 AM no Horário de Brasília)."""
    now_brt = datetime.datetime.now(BRT_TZ)
    if now_brt.hour < 3:
        start_brt = now_brt.replace(hour=3, minute=0, second=0, microsecond=0) - datetime.timedelta(days=1)
    else:
        start_brt = now_brt.replace(hour=3, minute=0, second=0, microsecond=0)
    return int(start_brt.timestamp() * 1000)

def get_db_connection():
    conn = sqlite3.connect(DB_PATH, timeout=5.0)
    conn.execute('PRAGMA journal_mode = WAL;')
    conn.execute('PRAGMA busy_timeout = 5000;')
    conn.execute('PRAGMA synchronous = NORMAL;')
    return conn

def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS extractions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp INTEGER NOT NULL,
                success INTEGER NOT NULL,
                duration_ms INTEGER NOT NULL,
                model TEXT NOT NULL,
                placa TEXT,
                modelo TEXT
            )
        ''')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_timestamp ON extractions(timestamp)')
        conn.commit()

def cleanup_old_records_loop():
    """Thread em background que expurga registros com mais de 7 dias a cada 1 hora."""
    while True:
        try:
            time.sleep(3600)
            week_ago_ms = int(time.time() * 1000) - (7 * 24 * 60 * 60 * 1000)
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('DELETE FROM extractions WHERE timestamp < ?', (week_ago_ms,))
                conn.commit()
        except Exception:
            pass

class TelemetryHandler(BaseHTTPRequestHandler):
    def _send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def do_OPTIONS(self):
        self.send_response(204)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self):
        start_ms = get_operational_day_start_ms()

        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT
                    COUNT(*),
                    COALESCE(SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END), 0),
                    AVG(CASE WHEN duration_ms > 0 THEN duration_ms ELSE NULL END),
                    MIN(CASE WHEN duration_ms > 0 THEN duration_ms ELSE NULL END)
                FROM extractions
                WHERE timestamp >= ?
            ''', (start_ms,))
            row = cursor.fetchone()

        total_today = row[0] if row else 0
        if total_today == 0:
            result = {
                "totalToday": 0,
                "successCount": 0,
                "successRate": 100.0,
                "avgDurationSec": 1.4,
                "fastestDurationSec": 1.1,
                "activeModelName": "Gemini 3.5 Flash Lite"
            }
        else:
            success_count = int(row[1])
            success_rate = round((success_count / total_today) * 100, 1)
            avg_ms = row[2]
            min_ms = row[3]
            avg_duration_sec = round(avg_ms / 1000.0, 1) if avg_ms is not None else 1.4
            fastest_duration_sec = round(min_ms / 1000.0, 1) if min_ms is not None else 1.1

            result = {
                "totalToday": total_today,
                "successCount": success_count,
                "successRate": success_rate,
                "avgDurationSec": avg_duration_sec,
                "fastestDurationSec": fastest_duration_sec,
                "activeModelName": "Gemini 3.5 Flash Lite"
            }

        response_bytes = json.dumps(result).encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self._send_cors_headers()
        self.end_headers()
        self.wfile.write(response_bytes)

    def do_POST(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body.decode('utf-8'))

            timestamp = int(data.get('timestamp') or time.time() * 1000)
            success = 1 if data.get('success', True) else 0
            duration_ms = int(data.get('durationMs', 1400))
            model = str(data.get('model', 'gemini-3.5-flash-lite'))
            placa = str(data.get('placa', ''))
            modelo = str(data.get('modelo', ''))

            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT INTO extractions (timestamp, success, duration_ms, model, placa, modelo)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (timestamp, success, duration_ms, model, placa, modelo))
                conn.commit()

            response_bytes = json.dumps({"ok": True}).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(response_bytes)
        except Exception as e:
            self.send_response(400)
            self.send_header('Content-Type', 'application/json')
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))

    def log_message(self, format, *args):
        # Silencia logs padroes para economizar I/O
        pass

if __name__ == '__main__':
    init_db()

    # Iniciar thread periodica de limpeza em background
    cleanup_thread = threading.Thread(target=cleanup_old_records_loop, daemon=True)
    cleanup_thread.start()

    port = int(os.environ.get('PORT', 8002))
    server = ThreadingHTTPServer(('0.0.0.0', port), TelemetryHandler)
    print(f"MEC Telemetry Service multithread rodando na porta {port}...")
    server.serve_forever()
