import json
import sqlite3
import time
import os
import sys
import secrets
import threading
import datetime
import urllib.request
import urllib.parse
from urllib.parse import urlparse, parse_qs
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler

DB_PATH = os.environ.get('DB_PATH', '/app/data/telemetry.db')
ADMIN_SECRET = os.environ.get('ADMIN_SECRET', 'brpmecadm')
STEAM_API_KEY = os.environ.get('STEAM_API_KEY', 'EEE3CB2D387EF9F6222A213F15CCDBA9')
NETLIFY_API_URL = os.environ.get('NETLIFY_API_URL', 'https://mecanicabrp1.netlify.app/api/funcionarios')
NETLIFY_API_KEY = os.environ.get('NETLIFY_API_KEY', 'Mecanica_API_2026_X8k29Pz71')
APP_BASE_URL = os.environ.get('APP_BASE_URL', 'https://mecanica.neco.lat')

BRT_TZ = datetime.timezone(datetime.timedelta(hours=-3))

def safe_log(msg: str):
    """Gera log seguro sem falhar em consoles cp1252/Windows."""
    try:
        print(f"[{datetime.datetime.now(BRT_TZ).strftime('%Y-%m-%d %H:%M:%S')}] {msg}")
    except Exception:
        pass

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
        
        # Tabela de Extrações OCR / Serviços
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
                service_mode TEXT,
                mechanic_steam_hex TEXT,
                mechanic_name TEXT
            )
        ''')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_timestamp ON extractions(timestamp)')

        # Migração segura para colunas novas caso a tabela já existisse
        cursor.execute('PRAGMA table_info(extractions)')
        columns = [row[1] for row in cursor.fetchall()]
        if 'servico' not in columns:
            cursor.execute('ALTER TABLE extractions ADD COLUMN servico TEXT')
        if 'service_mode' not in columns:
            cursor.execute('ALTER TABLE extractions ADD COLUMN service_mode TEXT')
        if 'mechanic_steam_hex' not in columns:
            cursor.execute('ALTER TABLE extractions ADD COLUMN mechanic_steam_hex TEXT')
        if 'mechanic_name' not in columns:
            cursor.execute('ALTER TABLE extractions ADD COLUMN mechanic_name TEXT')

        cursor.execute('CREATE INDEX IF NOT EXISTS idx_mechanic_hex ON extractions(mechanic_steam_hex)')

        # Tabela de Funcionários Autorizados (Sincronizada da API Netlify)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS funcionarios (
                steam_hex TEXT PRIMARY KEY,
                nome TEXT NOT NULL,
                avatar_url TEXT,
                ativo INTEGER DEFAULT 1,
                last_synced_at INTEGER NOT NULL
            )
        ''')

        # Tabela de Sessões de Login Steam (30 dias)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                steam_hex TEXT NOT NULL,
                nome TEXT NOT NULL,
                avatar_url TEXT,
                created_at INTEGER NOT NULL,
                expires_at INTEGER NOT NULL
            )
        ''')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_session_token ON sessions(token)')
        conn.commit()

def sync_funcionarios_from_api():
    """Sincroniza o quadro de funcionários consumindo a API externa Netlify."""
    try:
        req = urllib.request.Request(
            NETLIFY_API_URL,
            headers={
                'X-API-Key': NETLIFY_API_KEY,
                'User-Agent': 'MecBRP-OCR/2.6 (Ubuntu VPS Sync Daemon)'
            }
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status != 200:
                safe_log(f"[Sync Funcionarios] HTTP Error {resp.status}")
                return False, 0

            data = json.loads(resp.read().decode('utf-8'))
            funcionarios = data.get('funcionarios', [])
            if not funcionarios:
                return True, 0

            now_ms = int(time.time() * 1000)
            with get_db_connection() as conn:
                cursor = conn.cursor()
                for f in funcionarios:
                    raw_hex = f.get('steamHex', '').strip()
                    nome = f.get('nome', '').strip()
                    if not raw_hex:
                        continue
                    
                    # Normaliza o steamHex garantindo o prefixo 'steam:' em minusculas
                    clean_hex = raw_hex.lower()
                    if not clean_hex.startswith('steam:'):
                        clean_hex = f"steam:{clean_hex}"

                    cursor.execute('''
                        INSERT INTO funcionarios (steam_hex, nome, ativo, last_synced_at)
                        VALUES (?, ?, 1, ?)
                        ON CONFLICT(steam_hex) DO UPDATE SET
                            nome = excluded.nome,
                            ativo = 1,
                            last_synced_at = excluded.last_synced_at
                    ''', (clean_hex, nome, now_ms))
                conn.commit()
            safe_log(f"[Sync Funcionarios] Sucesso: {len(funcionarios)} membros sincronizados no SQLite.")
            return True, len(funcionarios)
    except Exception as e:
        safe_log(f"[Sync Funcionarios] Erro na sincronizacao: {e}")
        return False, 0

def fetch_steam_player_summary(steam_id_64: str):
    """Consulta a Steam Web API para buscar nome e avatar do perfil."""
    try:
        url = f"https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key={STEAM_API_KEY}&steamids={steam_id_64}"
        req = urllib.request.Request(url, headers={'User-Agent': 'MecBRP-OCR/2.6'})
        with urllib.request.urlopen(req, timeout=6) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode('utf-8'))
                players = data.get('response', {}).get('players', [])
                if players:
                    return players[0]
    except Exception as e:
        safe_log(f"[Steam API] Erro ao buscar player summary: {e}")
    return None

def verify_steam_openid_response(query_dict: dict) -> tuple[bool, str]:
    """Valida a assinatura OpenID 2.0 enviando check_authentication de volta para a Steam."""
    try:
        check_params = {k: v[0] for k, v in query_dict.items()}
        check_params['openid.mode'] = 'check_authentication'
        
        encoded_data = urllib.parse.urlencode(check_params).encode('utf-8')
        req = urllib.request.Request(
            'https://steamcommunity.com/openid/login',
            data=encoded_data,
            headers={
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'MecBRP-OCR/2.6'
            }
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            resp_text = resp.read().decode('utf-8')
            if 'is_valid:true' in resp_text:
                claimed_id = check_params.get('openid.claimed_id', '')
                # Exemplo de claimed_id: https://steamcommunity.com/openid/id/76561199235636728
                steam_id_64 = claimed_id.split('/')[-1] if '/' in claimed_id else ''
                return True, steam_id_64
            else:
                safe_log(f"[OpenID] Assinatura invalida da Steam: {resp_text}")
    except Exception as e:
        safe_log(f"[OpenID] Erro na validacao de assinatura: {e}")
    return False, ''

def background_tasks_loop():
    """Loop continuo em background para expurgo de dados antigos e sincronizacao periodica da Netlify API."""
    sync_interval_seconds = 1800 # Sincroniza a cada 30 minutos
    last_sync = 0
    
    while True:
        try:
            now = time.time()
            if now - last_sync >= sync_interval_seconds:
                sync_funcionarios_from_api()
                last_sync = now

            thirty_days_ago_ms = int(now * 1000) - (30 * 24 * 60 * 60 * 1000)
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('DELETE FROM extractions WHERE timestamp < ?', (thirty_days_ago_ms,))
                cursor.execute('DELETE FROM sessions WHERE expires_at < ?', (int(now * 1000),))
                conn.commit()
        except Exception as e:
            safe_log(f"[Background Tasks] Erro: {e}")
        time.sleep(60)

class TelemetryHandler(BaseHTTPRequestHandler):
    def _send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Secret, X-Session-Token')

    def do_OPTIONS(self):
        self.send_response(204)
        self._send_cors_headers()
        self.end_headers()

    def _get_auth_session(self):
        """Recupera e valida a sessao do mecanico autenticado."""
        auth_header = self.headers.get('Authorization', '')
        token = ''
        if auth_header.startswith('Bearer '):
            token = auth_header.replace('Bearer ', '').strip()
        if not token:
            token = self.headers.get('X-Session-Token', '').strip()
        
        if not token:
            parsed = urlparse(self.path)
            token = parse_qs(parsed.query).get('token', [''])[0].strip()

        if not token:
            return None

        now_ms = int(time.time() * 1000)
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT token, steam_hex, nome, avatar_url, expires_at FROM sessions WHERE token = ? AND expires_at > ?', (token, now_ms))
            row = cursor.fetchone()
            if row:
                return {
                    'token': row[0],
                    'steam_hex': row[1],
                    'nome': row[2],
                    'avatar_url': row[3],
                    'expires_at': row[4]
                }
        return None

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip('/')
        query_params = parse_qs(parsed.query)

        # 1. Rota de Inicio de Login Steam: Redireciona para steamcommunity.com
        if path.endswith('/auth/steam/login'):
            return_url = f"{APP_BASE_URL}/api/auth/steam/callback"
            openid_params = {
                'openid.ns': 'http://specs.openid.net/auth/2.0',
                'openid.mode': 'checkid_setup',
                'openid.return_to': return_url,
                'openid.realm': APP_BASE_URL,
                'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
                'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
            }
            steam_redirect_url = 'https://steamcommunity.com/openid/login?' + urllib.parse.urlencode(openid_params)
            self.send_response(302)
            self.send_header('Location', steam_redirect_url)
            self._send_cors_headers()
            self.end_headers()
            return

        # 2. Rota de Retorno / Callback da Steam
        if path.endswith('/auth/steam/callback'):
            is_valid, steam_id_64 = verify_steam_openid_response(query_params)
            if not is_valid or not steam_id_64:
                self.send_response(302)
                self.send_header('Location', f"{APP_BASE_URL}/#auth_error=steam_validation_failed")
                self.end_headers()
                return

            hex_id = format(int(steam_id_64), 'x')
            steam_hex = f"steam:{hex_id}"

            mechanic_name = None
            avatar_url = None

            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('SELECT nome, avatar_url FROM funcionarios WHERE steam_hex = ? AND ativo = 1', (steam_hex,))
                row = cursor.fetchone()
                if row:
                    mechanic_name = row[0]
                    avatar_url = row[1]

            # Se nao encontrou no banco local, tenta sincronizar a API Netlify imediatamente (On-Demand Fallback)
            if not mechanic_name:
                sync_funcionarios_from_api()
                with get_db_connection() as conn:
                    cursor = conn.cursor()
                    cursor.execute('SELECT nome, avatar_url FROM funcionarios WHERE steam_hex = ? AND ativo = 1', (steam_hex,))
                    row = cursor.fetchone()
                    if row:
                        mechanic_name = row[0]
                        avatar_url = row[1]

            # Se ainda assim nao estiver na lista de membros autorizados, bloqueia o acesso
            if not mechanic_name:
                self.send_response(302)
                self.send_header('Location', f"{APP_BASE_URL}/#auth_error=not_authorized&steamHex={urllib.parse.quote(steam_hex)}")
                self.end_headers()
                return

            # Busca foto do perfil via Steam Web API se nao tiver salva
            player_info = fetch_steam_player_summary(steam_id_64)
            if player_info and player_info.get('avatarfull'):
                avatar_url = player_info.get('avatarfull')
                with get_db_connection() as conn:
                    cursor = conn.cursor()
                    cursor.execute('UPDATE funcionarios SET avatar_url = ? WHERE steam_hex = ?', (avatar_url, steam_hex))
                    conn.commit()

            # Cria Sessao de 30 Dias para o Mecanico
            now_ms = int(time.time() * 1000)
            expires_at = now_ms + (30 * 24 * 60 * 60 * 1000)
            session_token = secrets.token_urlsafe(32)

            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT INTO sessions (token, steam_hex, nome, avatar_url, created_at, expires_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (session_token, steam_hex, mechanic_name, avatar_url or '', now_ms, expires_at))
                conn.commit()

            # Redireciona para a Home autenticado
            redirect_target = (
                f"{APP_BASE_URL}/#token={session_token}"
                f"&nome={urllib.parse.quote(mechanic_name)}"
                f"&steamHex={urllib.parse.quote(steam_hex)}"
                f"&avatar={urllib.parse.quote(avatar_url or '')}"
            )
            self.send_response(302)
            self.send_header('Location', redirect_target)
            self.end_headers()
            return

        # 3. Rota de Checagem da Sessao Ativa
        if path.endswith('/auth/me'):
            session = self._get_auth_session()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Cache-Control', 'no-cache, no-store')
            self._send_cors_headers()
            self.end_headers()
            if session:
                self.wfile.write(json.dumps({
                    "authenticated": True,
                    "user": {
                        "steamHex": session['steam_hex'],
                        "nome": session['nome'],
                        "avatarUrl": session['avatar_url'],
                        "expiresAt": session['expires_at']
                    }
                }).encode('utf-8'))
            else:
                self.wfile.write(json.dumps({"authenticated": False}).encode('utf-8'))
            return

        # 4. Painel Administrativo
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
                self.wfile.write(json.dumps({"error": "Acesso nao autorizado ao painel administrativo"}).encode('utf-8'))
                return

            self._handle_admin_metrics()
            return

        # 5. Endpoint Publico de Metricas Rapidas (Home)
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

            # Resumo do Dia
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

            total_today = today_row[0] if today_row else 0
            success_count = int(today_row[1]) if today_row and today_row[1] else 0
            success_rate = round((success_count / total_today) * 100, 1) if total_today > 0 else 100.0
            avg_ms = today_row[2] if today_row else None
            min_ms = today_row[3] if today_row else None

            # Resumo da Semana
            cursor.execute('SELECT COUNT(*) FROM extractions WHERE timestamp >= ?', (week_ago_ms,))
            week_row = cursor.fetchone()

            # Divisao por Tipo de Servico Hoje
            cursor.execute('''
                SELECT COALESCE(service_mode, 'oleo'), COUNT(*)
                FROM extractions
                WHERE timestamp >= ?
                GROUP BY service_mode
            ''', (start_ms,))
            services_today = dict(cursor.fetchall())

            # Divisao por IA Provedor Hoje
            cursor.execute('''
                SELECT model, COUNT(*)
                FROM extractions
                WHERE timestamp >= ?
                GROUP BY model
            ''', (start_ms,))
            models_today = dict(cursor.fetchall())

            # Horarios de Pico Hoje (24 Horas)
            cursor.execute('''
                SELECT timestamp
                FROM extractions
                WHERE timestamp >= ?
            ''', (start_ms,))
            timestamps_today = [r[0] for r in cursor.fetchall()]

            # Ranking Consolidado de Mecanicos
            cursor.execute('''
                SELECT 
                    COALESCE(e.mechanic_steam_hex, 'desconhecido') as hex,
                    COALESCE(f.nome, e.mechanic_name, 'Mecanico Nao Identificado') as nome,
                    COALESCE(f.avatar_url, '') as avatar_url,
                    COUNT(*) as total_fichas,
                    SUM(CASE WHEN e.service_mode = 'oleo' THEN 1 ELSE 0 END) as total_oleo,
                    SUM(CASE WHEN e.service_mode = 'tuning' THEN 1 ELSE 0 END) as total_tuning,
                    SUM(CASE WHEN e.service_mode = 'retifica' THEN 1 ELSE 0 END) as total_retifica,
                    SUM(CASE WHEN e.service_mode = 'extra' THEN 1 ELSE 0 END) as total_extra,
                    SUM(CASE WHEN e.timestamp >= ? THEN 1 ELSE 0 END) as hoje_fichas,
                    SUM(CASE WHEN e.timestamp >= ? THEN 1 ELSE 0 END) as semana_fichas
                FROM extractions e
                LEFT JOIN funcionarios f ON e.mechanic_steam_hex = f.steam_hex
                WHERE e.mechanic_steam_hex IS NOT NULL AND e.mechanic_steam_hex != ''
                GROUP BY hex
                ORDER BY total_fichas DESC
            ''', (start_ms, week_ago_ms))
            ranking_rows = cursor.fetchall()
            
            ranking_list = []
            for r in ranking_rows:
                ranking_list.append({
                    "steamHex": r[0],
                    "nome": r[1],
                    "avatarUrl": r[2],
                    "totalFichas": r[3],
                    "totalOleo": r[4],
                    "totalTuning": r[5],
                    "totalRetifica": r[6],
                    "totalExtra": r[7],
                    "hojeFichas": r[8],
                    "semanaFichas": r[9]
                })

            # Lista Completa de Funcionarios Cadastrados
            cursor.execute('SELECT steam_hex, nome, avatar_url, ativo, last_synced_at FROM funcionarios ORDER BY nome ASC')
            func_rows = cursor.fetchall()
            funcionarios_list = []
            for fr in func_rows:
                funcionarios_list.append({
                    "steamHex": fr[0],
                    "nome": fr[1],
                    "avatarUrl": fr[2] or '',
                    "ativo": bool(fr[3]),
                    "lastSyncedAt": fr[4]
                })

            # Logs Recentes (Ultimos 100 Registros)
            cursor.execute('''
                SELECT id, timestamp, success, duration_ms, model, placa, modelo, servico, service_mode, mechanic_name, mechanic_steam_hex
                FROM extractions
                ORDER BY id DESC
                LIMIT 100
            ''')
            log_rows = cursor.fetchall()

        # Montagem dos 24 horarios de pico
        hourly_counts = {h: 0 for h in range(24)}
        for ts in timestamps_today:
            dt = datetime.datetime.fromtimestamp(ts / 1000.0, tz=BRT_TZ)
            hourly_counts[dt.hour] += 1

        hourly_data = [{"hour": f"{h:02d}:00", "count": hourly_counts[h]} for h in range(24)]

        recent_logs = []
        for r in log_rows:
            dt = datetime.datetime.fromtimestamp(r[1] / 1000.0, tz=BRT_TZ)
            recent_logs.append({
                "id": r[0],
                "timestamp": r[1],
                "dateTimeStr": dt.strftime('%d/%m %H:%M:%S'),
                "success": bool(r[2]),
                "durationMs": r[3],
                "durationSec": round(r[3] / 1000.0, 2),
                "model": r[4],
                "placa": r[5] or 'N/A',
                "modelo": r[6] or 'N/A',
                "servico": r[7] or 'Troca de oleo e filtro',
                "serviceMode": r[8] or 'oleo',
                "mechanicName": r[9] or 'Anonimo',
                "mechanicSteamHex": r[10] or ''
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
            "ranking": ranking_list,
            "funcionarios": funcionarios_list,
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
            body = self.rfile.read(content_length) if content_length > 0 else b'{}'
            data = json.loads(body.decode('utf-8')) if body else {}

            # Rota de Logout
            if path.endswith('/auth/logout'):
                session = self._get_auth_session()
                if session:
                    with get_db_connection() as conn:
                        cursor = conn.cursor()
                        cursor.execute('DELETE FROM sessions WHERE token = ?', (session['token'],))
                        conn.commit()
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"ok": True}).encode('utf-8'))
                return

            # Sincronizacao Manual Forcada de Funcionarios (Admin)
            if path.endswith('/admin/sync-funcionarios'):
                secret_provided = (
                    data.get('secret', '')
                    or self.headers.get('X-Admin-Secret', '')
                    or self.headers.get('Authorization', '').replace('Bearer ', '')
                )
                if secret_provided != ADMIN_SECRET:
                    self.send_response(401)
                    self.send_header('Content-Type', 'application/json')
                    self._send_cors_headers()
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": "Acesso nao autorizado"}).encode('utf-8'))
                    return

                ok, count = sync_funcionarios_from_api()
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"success": ok, "total": count}).encode('utf-8'))
                return

            # Atualizacao de Servico Modificado pelo Mecanico
            if path.endswith('/update'):
                servico = str(data.get('servico', ''))
                service_mode = str(data.get('serviceMode', ''))
                ext_id = data.get('id')
                placa = data.get('placa')
                mechanic_steam_hex = data.get('mechanicSteamHex')
                mechanic_name = data.get('mechanicName')

                with get_db_connection() as conn:
                    cursor = conn.cursor()
                    if ext_id:
                        cursor.execute('''
                            UPDATE extractions
                            SET servico = ?, service_mode = ?
                            WHERE id = ?
                        ''', (servico, service_mode, ext_id))
                    elif placa and str(placa).strip() not in ('', '[Sem Placa]', '[Não identificado]', '[Nao identificado]'):
                        clean_placa = str(placa).replace(' ', '').upper()
                        cursor.execute('''
                            UPDATE extractions
                            SET servico = ?, service_mode = ?
                            WHERE id = (
                                SELECT id FROM extractions 
                                WHERE REPLACE(UPPER(placa), ' ', '') = ? 
                                ORDER BY id DESC LIMIT 1
                            )
                        ''', (servico, service_mode, clean_placa))
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

            # Insercao Padrao de Nova Extracao OCR
            timestamp = int(data.get('timestamp') or time.time() * 1000)
            success = 1 if data.get('success', True) else 0
            duration_ms = int(data.get('durationMs', 1400))
            model = str(data.get('model', 'gemini-3.5-flash-lite'))
            placa = str(data.get('placa', ''))
            modelo = str(data.get('modelo', ''))
            servico = str(data.get('servico', 'Troca de oleo e filtro'))
            service_mode = str(data.get('serviceMode', 'oleo'))
            mechanic_steam_hex = data.get('mechanicSteamHex') or ''
            mechanic_name = data.get('mechanicName') or ''

            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT INTO extractions (timestamp, success, duration_ms, model, placa, modelo, servico, service_mode, mechanic_steam_hex, mechanic_name)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (timestamp, success, duration_ms, model, placa, modelo, servico, service_mode, mechanic_steam_hex, mechanic_name))
                conn.commit()

            response_bytes = json.dumps({"ok": True}).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(response_bytes)

        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))

def run_server(port=8002):
    init_db()
    sync_thread = threading.Thread(target=sync_funcionarios_from_api, daemon=True)
    sync_thread.start()

    bg_thread = threading.Thread(target=background_tasks_loop, daemon=True)
    bg_thread.start()

    server_address = ('0.0.0.0', port)
    httpd = ThreadingHTTPServer(server_address, TelemetryHandler)
    safe_log(f"Servidor Telemetria & Autenticacao Mecanica BRP rodando na porta {port}...")
    httpd.serve_forever()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8002))
    run_server(port)
