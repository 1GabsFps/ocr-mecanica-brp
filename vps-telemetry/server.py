import json
import sqlite3
import time
import os
from http.server import HTTPServer, BaseHTTPRequestHandler

DB_PATH = os.environ.get('DB_PATH', '/app/data/telemetry.db')

def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    with sqlite3.connect(DB_PATH) as conn:
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
        now_ms = int(time.time() * 1000)
        day_ago_ms = now_ms - (24 * 60 * 60 * 1000)

        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT success, duration_ms, model FROM extractions
                WHERE timestamp >= ?
            ''', (day_ago_ms,))
            rows = cursor.fetchall()

        total_today = len(rows)
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
            success_count = sum(1 for r in rows if r[0] == 1)
            success_rate = round((success_count / total_today) * 100, 1)
            durations = [r[1] for r in rows if r[1] > 0]
            avg_duration_sec = round((sum(durations) / len(durations) / 1000), 1) if durations else 1.4
            fastest_duration_sec = round((min(durations) / 1000), 1) if durations else 1.1

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

            with sqlite3.connect(DB_PATH) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT INTO extractions (timestamp, success, duration_ms, model, placa, modelo)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (timestamp, success, duration_ms, model, placa, modelo))
                
                # Limpar registros com mais de 7 dias
                week_ago_ms = int(time.time() * 1000) - (7 * 24 * 60 * 60 * 1000)
                cursor.execute('DELETE FROM extractions WHERE timestamp < ?', (week_ago_ms,))
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
        # Silencia logs padrões para economizar I/O
        pass

if __name__ == '__main__':
    init_db()
    port = int(os.environ.get('PORT', 8002))
    server = HTTPServer(('0.0.0.0', port), TelemetryHandler)
    print(f"MEC Telemetry Service rodando na porta {port}...")
    server.serve_forever()
