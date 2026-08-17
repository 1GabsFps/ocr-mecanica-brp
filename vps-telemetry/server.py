import json
import sqlite3
import time
import os
import threading
import datetime
from urllib.parse import urlparse, parse_qs
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler

DB_PATH = os.environ.get('DB_PATH', '/app/data/telemetry.db')
ADMIN_SECRET = os.environ.get('ADMIN_SECRET', 'brpmecadm')
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
                modelo TEXT,
                servico TEXT,
                service_mode TEXT
            )
        ''')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_timestamp ON extractions(timestamp)')

        # Migração segura para bases existentes
        cursor.execute('PRAGMA table_info(extractions)')
        columns = [row[1] for row in cursor.fetchall()]
        if 'servico' not in columns:
            cursor.execute('ALTER TABLE extractions ADD COLUMN servico TEXT')
        if 'service_mode' not in columns:
            cursor.execute('ALTER TABLE extractions ADD COLUMN service_mode TEXT')
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
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Secret')

    def do_OPTIONS(self):
        self.send_response(204)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip('/')
        query_params = parse_qs(parsed.query)

        # Endpoint Administrativo Seguro
        if path.endswith('/admin') or query_params.get('admin', ['0'])[0] == '1':
            secret_provided = (
                query_params.get('secret', [''])[0]
                or self.headers.get('X-Admin-Secret', '')
                or self.headers.get('Authorization', '').replace('Bearer ', '')
            )
            if secret_provided != ADMIN_SECRET:
                self.send_response(401)
                self.send_header('Content-Type', 'application/json')
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Acesso não autorizado ao painel administrativo"}).encode('utf-8'))
                return

            self._handle_admin_metrics()
            return

        # Endpoint Público de Métricas Rápidas (Card Diário da Home)
        self._handle_public_metrics()

    def _handle_public_metrics(self):
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

    def _handle_admin_metrics(self):
        start_ms = get_operational_day_start_ms()
        week_ago_ms = int(time.time() * 1000) - (7 * 24 * 60 * 60 * 1000)

        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Resumo Hoje
            cursor.execute('''
                SELECT
                    COUNT(*),
                    COALESCE(SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END), 0),
                    AVG(CASE WHEN duration_ms > 0 THEN duration_ms ELSE NULL END),
                    MIN(CASE WHEN duration_ms > 0 THEN duration_ms ELSE NULL END)
                FROM extractions
                WHERE timestamp >= ?
            ''', (start_ms,))
            today_row = cursor.fetchone()

            # Total Semana
            cursor.execute('SELECT COUNT(*) FROM extractions WHERE timestamp >= ?', (week_ago_ms,))
            week_row = cursor.fetchone()

            # Distribuição por Modo de Serviço (Hoje)
            cursor.execute('''
                SELECT COALESCE(service_mode, 'oleo'), COUNT(*)
                FROM extractions
                WHERE timestamp >= ?
                GROUP BY COALESCE(service_mode, 'oleo')
            ''', (start_ms,))
            services_today = dict(cursor.fetchall())

            # Distribuição por Provedor de IA (Hoje)
            cursor.execute('''
                SELECT
                    CASE
                        WHEN model LIKE '%cloudflare%' OR model LIKE '%llama%' THEN 'Cloudflare Llama 3.2'
                        WHEN model LIKE '%gemini%' THEN 'Google Gemini 3.5'
                        ELSE 'Outros'
                    END as prov,
                    COUNT(*)
                FROM extractions
                WHERE timestamp >= ?
                GROUP BY prov
            ''', (start_ms,))
            models_today = dict(cursor.fetchall())

            # Distribuição Horária (Hoje - 24 horas)
            cursor.execute('''
                SELECT timestamp
                FROM extractions
                WHERE timestamp >= ?
            ''', (start_ms,))
            timestamps = [r[0] for r in cursor.fetchall()]

            # Últimos 50 Logs
            cursor.execute('''
                SELECT id, timestamp, success, duration_ms, model, placa, modelo, servico, service_mode
                FROM extractions
                ORDER BY id DESC
                LIMIT 50
            ''')
            recent_rows = cursor.fetchall()

        # Monta array de horas de 00h às 23h
        hourly_counts = [0] * 24
        for ts in timestamps:
            dt = datetime.datetime.fromtimestamp(ts / 1000.0, BRT_TZ)
            hourly_counts[dt.hour] += 1

        hourly_data = [{"hour": f"{h:02d}:00", "count": hourly_counts[h]} for h in range(24)]

        total_today = today_row[0] if today_row else 0
        success_today = today_row[1] if today_row else 0
        success_rate = round((success_today / total_today) * 100, 1) if total_today > 0 else 100.0
        avg_ms = today_row[2] if today_row else 0
        min_ms = today_row[3] if today_row else 0

        recent_logs = []
        for r in recent_rows:
            dt_str = datetime.datetime.fromtimestamp(r[1] / 1000.0, BRT_TZ).strftime('%d/%m %H:%M:%S')
            recent_logs.append({
                "id": r[0],
                "timestamp": r[1],
                "dateTimeStr": dt_str,
                "success": bool(r[2]),
                "durationMs": r[3],
                "durationSec": round(r[3] / 1000.0, 2),
                "model": r[4],
                "placa": r[5] or '[Sem Placa]',
                "modelo": r[6] or '[Veículo]',
                "servico": r[7] or 'Troca de óleo e filtro',
                "serviceMode": r[8] or 'oleo'
            })

        admin_payload = {
            "summary": {
                "totalToday": total_today,
                "totalWeek": week_row[0] if week_row else 0,
                "successRate": success_rate,
                "avgDurationSec": round(avg_ms / 1000.0, 2) if avg_ms else 1.4,
                "fastestDurationSec": round(min_ms / 1000.0, 2) if min_ms else 1.1,
            },
            "serviceBreakdown": {
                "oleo": services_today.get('oleo', 0),
                "tuning": services_today.get('tuning', 0),
                "retifica": services_today.get('retifica', 0),
                "extra": services_today.get('extra', 0),
            },
            "modelBreakdown": models_today,
            "hourly": hourly_data,
            "recentLogs": recent_logs
        }

        response_bytes = json.dumps(admin_payload).encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self._send_cors_headers()
        self.end_headers()
        self.wfile.write(response_bytes)

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip('/')

        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body.decode('utf-8'))

            # Atualização de Serviço Modificado pelo Mecânico
            if path.endswith('/update'):
                servico = str(data.get('servico', ''))
                service_mode = str(data.get('serviceMode', ''))
                ext_id = data.get('id')
                placa = data.get('placa')

                with get_db_connection() as conn:
                    cursor = conn.cursor()
                    if ext_id:
                        cursor.execute('''
                            UPDATE extractions
                            SET servico = ?, service_mode = ?
                            WHERE id = ?
                        ''', (servico, service_mode, ext_id))
                    elif placa:
                        cursor.execute('''
                            UPDATE extractions
                            SET servico = ?, service_mode = ?
                            WHERE id = (
                                SELECT id FROM extractions WHERE placa = ? ORDER BY id DESC LIMIT 1
                            )
                        ''', (servico, service_mode, placa))
                    else:
                        cursor.execute('''
                            UPDATE extractions
                            SET servico = ?, service_mode = ?
                            WHERE id = (
                                SELECT id FROM extractions ORDER BY id DESC LIMIT 1
                            )
                        ''', (servico, service_mode))
                    conn.commit()

                response_bytes = json.dumps({"ok": True, "updated": True}).encode('utf-8')
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(response_bytes)
                return

            # Inserção Padrão de Nova Extração
            timestamp = int(data.get('timestamp') or time.time() * 1000)
            success = 1 if data.get('success', True) else 0
            duration_ms = int(data.get('durationMs', 1400))
            model = str(data.get('model', 'gemini-3.5-flash-lite'))
            placa = str(data.get('placa', ''))
            modelo = str(data.get('modelo', ''))
            servico = str(data.get('servico', 'Troca de óleo e filtro'))
            service_mode = str(data.get('serviceMode', 'oleo'))

            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT INTO extractions (timestamp, success, duration_ms, model, placa, modelo, servico, service_mode)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (timestamp, success, duration_ms, model, placa, modelo, servico, service_mode))
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
