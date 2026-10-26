import json
import sqlite3
import time
import os
import sys
import base64
import secrets
import threading
import datetime
import re
import unicodedata
import socket
import ipaddress
import urllib.request
import urllib.parse
from urllib.parse import urlparse, parse_qs
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from contextlib import contextmanager

def load_dotenv():
    candidates = [
        '/app/data/.env',
        '/app/.env',
        os.path.join(os.getcwd(), '.env'),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env'),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', '.env')
    ]
    for c in candidates:
        if os.path.isfile(c):
            try:
                with open(c, 'r', encoding='utf-8') as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith('#') and '=' in line:
                            k, v = line.split('=', 1)
                            k = k.strip()
                            v = v.strip().strip('"').strip("'")
                            if k not in os.environ:
                                os.environ[k] = v
                break
            except Exception:
                pass

load_dotenv()

DB_PATH = os.environ.get('DB_PATH', '/app/data/telemetry.db')
ADMIN_SECRET = os.environ.get('ADMIN_SECRET', '')
STEAM_API_KEY = os.environ.get('STEAM_API_KEY', '')
NETLIFY_API_URL = os.environ.get('NETLIFY_API_URL', 'https://mecanica.gbrdev.net/api/funcionarios') if os.environ.get('NETLIFY_API_URL') else 'https://mecanicabrp1.netlify.app/api/funcionarios'
NETLIFY_API_KEY = os.environ.get('NETLIFY_API_KEY', '')
APP_BASE_URL = os.environ.get('APP_BASE_URL', 'https://mecanica.gbrdev.net')
DISCORD_WEBHOOK_URL = os.environ.get('DISCORD_WEBHOOK_URL', '')
DISCORD_TOKEN = os.environ.get('DISCORD_TOKEN', '')
ALLOWED_ORIGINS = [
    o.strip() for o in os.environ.get(
        'ALLOWED_ORIGINS',
        'https://mecanica.gbrdev.net,https://mecanicabrp1.netlify.app,http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173'
    ).split(',') if o.strip()
]

BRT_TZ = datetime.timezone(datetime.timedelta(hours=-3))

IGNORED_STAFF_HEXES = {
    'steam:11000015ecf682c',
    'steam:110000106803154'
}

DISCORD_BOT_IDS = {
    '1389359764806303867',  # Spidey Bot
    '1389366500225454120',  # Captain Hook
}

DISCORD_BOT_NAMES = {
    'spidey bot', 'spideybot', 'captain hook', 'captainhook', 'webhook', 'spidey'
}

def extract_member_discord_id(discord_tag: str, full_content: str, author_id: str = '', author_user: str = '') -> str:
    # 1. Se author_user for um bot conhecido ou webhook, descarta author_id imediatamente
    if author_user and any(b in author_user.lower() for b in DISCORD_BOT_NAMES):
        author_id = ''
    if author_id in DISCORD_BOT_IDS:
        author_id = ''

    # 2. Busca menção explícita <@123456789...> ou ID no discord_tag (ex: "<@360891178356310016>")
    if discord_tag:
        m = re.search(r'<@!?(\d{17,20})>', discord_tag)
        if m and m.group(1) not in DISCORD_BOT_IDS:
            return m.group(1)
        m_num = re.search(r'\b(\d{17,20})\b', discord_tag)
        if m_num and m_num.group(1) not in DISCORD_BOT_IDS:
            return m_num.group(1)

    # 3. Busca no full_content por campos de Discord
    if full_content:
        m_disc = re.search(r'(?:Discord|Autor|Mecânico|Mecanico|Funcionário|Funcionario)[:\s]*<@!?(\d{17,20})>', full_content, re.IGNORECASE)
        if m_disc and m_disc.group(1) not in DISCORD_BOT_IDS:
            return m_disc.group(1)

        m_disc_raw = re.search(r'(?:Discord|Autor|Mecânico|Mecanico|Funcionário|Funcionario)[:\s]*(\d{17,20})\b', full_content, re.IGNORECASE)
        if m_disc_raw and m_disc_raw.group(1) not in DISCORD_BOT_IDS:
            return m_disc_raw.group(1)

        # Procura qualquer menção que NÃO seja de bot
        for m_any in re.finditer(r'<@!?(\d{17,20})>', full_content):
            did = m_any.group(1)
            if did not in DISCORD_BOT_IDS:
                return did

    # 4. Fallback apenas se author_id não for de bot nem vazio
    if author_id and author_id not in DISCORD_BOT_IDS:
        return author_id

    return ''

FAILED_ADMIN_ATTEMPTS = {}
ATTEMPTS_LOCK = threading.Lock()
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_WINDOW_SECONDS = 900

def check_ip_rate_limit(ip: str):
    now = time.time()
    with ATTEMPTS_LOCK:
        if ip not in FAILED_ADMIN_ATTEMPTS:
            return True, 0
        
        recent = [t for t in FAILED_ADMIN_ATTEMPTS[ip] if now - t < LOCKOUT_WINDOW_SECONDS]
        FAILED_ADMIN_ATTEMPTS[ip] = recent
        
        if len(recent) >= MAX_FAILED_ATTEMPTS:
            oldest = min(recent)
            remaining = int(LOCKOUT_WINDOW_SECONDS - (now - oldest))
            return False, max(remaining, 1)
        return True, 0

def record_failed_attempt(ip: str):
    now = time.time()
    with ATTEMPTS_LOCK:
        if ip not in FAILED_ADMIN_ATTEMPTS:
            FAILED_ADMIN_ATTEMPTS[ip] = []
        FAILED_ADMIN_ATTEMPTS[ip].append(now)

def clear_failed_attempts(ip: str):
    with ATTEMPTS_LOCK:
        FAILED_ADMIN_ATTEMPTS.pop(ip, None)

WEBHOOK_ATTEMPTS = {}
WEBHOOK_LOCK = threading.Lock()
MAX_WEBHOOK_PER_MINUTE = 15

def check_webhook_rate_limit(ip: str) -> bool:
    now = time.time()
    with WEBHOOK_LOCK:
        recent = [t for t in WEBHOOK_ATTEMPTS.get(ip, []) if now - t < 60]
        if len(recent) >= MAX_WEBHOOK_PER_MINUTE:
            return False
        recent.append(now)
        WEBHOOK_ATTEMPTS[ip] = recent
        return True

def is_safe_proxy_url(url_str: str) -> tuple[bool, str]:
    try:
        parsed = urlparse(url_str)
        if parsed.scheme not in ('http', 'https'):
            return False, "Apenas protocolos HTTP e HTTPS são permitidos."
        
        hostname = parsed.hostname
        if not hostname:
            return False, "URL inválida: hostname não especificado."

        lower_host = hostname.lower()
        if lower_host in ('localhost', '127.0.0.1', '::1', '0.0.0.0'):
            return False, "Acesso a localhost/loopback não é permitido."

        port = parsed.port or (443 if parsed.scheme == 'https' else 80)
        addr_info = socket.getaddrinfo(hostname, port, type=socket.SOCK_STREAM)
        for entry in addr_info:
            ip_str = entry[4][0]
            ip = ipaddress.ip_address(ip_str)
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_reserved or ip.is_unspecified:
                return False, f"Acesso a endereços locais ou redes privadas é bloqueado ({ip_str})."
        
        return True, ""
    except Exception as e:
        return False, f"Falha na validação de segurança da URL: {e}"

def safe_log(msg: str):
    try:
        print(f"[{datetime.datetime.now(BRT_TZ).strftime('%Y-%m-%d %H:%M:%S')}] {msg}")
    except Exception:
        pass

def get_operational_day_start_ms():
    now_brt = datetime.datetime.now(BRT_TZ)
    if now_brt.hour < 3:
        start_brt = now_brt.replace(hour=3, minute=0, second=0, microsecond=0) - datetime.timedelta(days=1)
    else:
        start_brt = now_brt.replace(hour=3, minute=0, second=0, microsecond=0)
    return int(start_brt.timestamp() * 1000)

@contextmanager
def get_db_connection():
    conn = sqlite3.connect(DB_PATH, timeout=30.0, check_same_thread=False)
    conn.execute('PRAGMA busy_timeout = 10000;')
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    raw_conn = sqlite3.connect(DB_PATH, timeout=30.0)
    try:
        raw_conn.execute('PRAGMA journal_mode = WAL;')
        raw_conn.execute('PRAGMA synchronous = NORMAL;')
        raw_conn.commit()
    finally:
        raw_conn.close()

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
                service_mode TEXT,
                mechanic_steam_hex TEXT,
                mechanic_name TEXT
            )
        ''')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_timestamp ON extractions(timestamp)')

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
        if 'gpu_model' not in columns:
            cursor.execute('ALTER TABLE extractions ADD COLUMN gpu_model TEXT')
        if 'hardware_info' not in columns:
            cursor.execute('ALTER TABLE extractions ADD COLUMN hardware_info TEXT')

        cursor.execute('CREATE INDEX IF NOT EXISTS idx_mechanic_hex ON extractions(mechanic_steam_hex)')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS funcionarios (
                steam_hex TEXT PRIMARY KEY,
                nome TEXT NOT NULL,
                avatar_url TEXT,
                ativo INTEGER DEFAULT 1,
                last_synced_at INTEGER NOT NULL
            )
        ''')

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

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS inventory (
                id TEXT PRIMARY KEY,
                nome TEXT NOT NULL,
                categoria TEXT NOT NULL,
                quantidade_atual INTEGER NOT NULL,
                meta_minima INTEGER NOT NULL,
                unidade TEXT DEFAULT 'un',
                icone TEXT,
                descricao TEXT,
                ultima_atualizacao INTEGER NOT NULL,
                atualizado_por TEXT
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS inventory_transactions (
                id TEXT PRIMARY KEY,
                item_id TEXT,
                item_nome TEXT NOT NULL,
                tipo TEXT NOT NULL,
                quantidade INTEGER NOT NULL,
                mecanico_nome TEXT NOT NULL,
                mecanico_discord TEXT,
                mecanico_steam_hex TEXT,
                data_hora_str TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                observacao TEXT
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS work_hours (
                id TEXT PRIMARY KEY,
                mecanico_steam_hex TEXT NOT NULL,
                mecanico_nome TEXT NOT NULL,
                mecanico_discord TEXT,
                cargo TEXT NOT NULL,
                entrada_timestamp INTEGER NOT NULL,
                saida_timestamp INTEGER,
                duracao_minutos INTEGER NOT NULL,
                status TEXT NOT NULL,
                turno TEXT NOT NULL,
                data_str TEXT NOT NULL,
                horario_entrada_str TEXT NOT NULL,
                horario_saida_str TEXT,
                criado_manualmente INTEGER DEFAULT 0,
                observacao TEXT
            )
        ''')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_work_hours_hex ON work_hours(mecanico_steam_hex)')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS member_roles (
                steam_hex TEXT PRIMARY KEY,
                cargo TEXT NOT NULL,
                updated_at INTEGER NOT NULL,
                updated_by TEXT,
                discord_id TEXT
            )
        ''')
        cursor.execute('PRAGMA table_info(member_roles)')
        mr_cols = [c[1] for c in cursor.fetchall()]
        if 'discord_id' not in mr_cols:
            cursor.execute('ALTER TABLE member_roles ADD COLUMN discord_id TEXT')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                admin_steam_hex TEXT NOT NULL,
                admin_nome TEXT,
                action_type TEXT NOT NULL,
                target_id TEXT,
                description TEXT,
                details_json TEXT,
                timestamp INTEGER NOT NULL,
                ip_address TEXT
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS faturas (
                id TEXT PRIMARY KEY,
                funcionario_nome TEXT NOT NULL,
                funcionario_steam_hex TEXT,
                funcionario_discord TEXT,
                cliente_nome TEXT,
                cliente_steam_hex TEXT,
                cliente_discord TEXT,
                servicos_json TEXT NOT NULL,
                valor_total INTEGER NOT NULL,
                valor_guincho INTEGER DEFAULT 0,
                tipo_registro TEXT NOT NULL,
                guincho_cidade_qtd INTEGER DEFAULT 0,
                guincho_fora_qtd INTEGER DEFAULT 0,
                timestamp INTEGER NOT NULL,
                data_str TEXT NOT NULL,
                horario_str TEXT NOT NULL
            )
        ''')
        try:
            cursor.execute('ALTER TABLE faturas ADD COLUMN valor_guincho INTEGER DEFAULT 0')
        except Exception:
            pass
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS work_hours_cycles (
                id TEXT PRIMARY KEY,
                label TEXT NOT NULL,
                start_timestamp INTEGER,
                end_timestamp INTEGER,
                archived_at INTEGER NOT NULL,
                archived_by_hex TEXT,
                archived_by_nome TEXT,
                total_hours_minutos INTEGER DEFAULT 0,
                total_membros INTEGER DEFAULT 0,
                ranking_json TEXT
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS work_hours_archive (
                id TEXT PRIMARY KEY,
                cycle_id TEXT NOT NULL,
                mecanico_steam_hex TEXT,
                mecanico_nome TEXT,
                cargo TEXT,
                entrada_timestamp INTEGER,
                saida_timestamp INTEGER,
                duracao_minutos INTEGER,
                status TEXT,
                turno TEXT,
                data_str TEXT,
                horario_entrada_str TEXT,
                horario_saida_str TEXT,
                observacao TEXT
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS system_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at INTEGER NOT NULL,
                updated_by TEXT
            )
        ''')

        cursor.execute('CREATE INDEX IF NOT EXISTS idx_faturas_func_hex ON faturas(funcionario_steam_hex)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_faturas_timestamp ON faturas(timestamp)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_faturas_tipo ON faturas(tipo_registro)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_work_hours_status ON work_hours(status)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_work_hours_entrada ON work_hours(entrada_timestamp)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_wh_archive_cycle ON work_hours_archive(cycle_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_wh_archive_hex ON work_hours_archive(mecanico_steam_hex)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_inv_item_time ON inventory_transactions(item_id, timestamp)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp)')

        conn.commit()

def get_period_time_range(period_str):
    now_dt = datetime.datetime.now(BRT_TZ)
    days_since_monday = now_dt.weekday() # 0 = Segunda, 6 = Domingo
    start_current_week = (now_dt - datetime.timedelta(days=days_since_monday)).replace(hour=0, minute=0, second=0, microsecond=0)
    start_last_week = start_current_week - datetime.timedelta(days=7)
    end_last_week = start_current_week - datetime.timedelta(milliseconds=1)

    p = (period_str or 'geral').lower().strip()
    if p == 'hoje':
        start_today = now_dt.replace(hour=0, minute=0, second=0, microsecond=0)
        return int(start_today.timestamp() * 1000), 0
    elif p in ('semana', 'esta_semana', 'atual'):
        return int(start_current_week.timestamp() * 1000), 0
    elif p in ('semana_anterior', 'semana_passada', 'anterior'):
        return int(start_last_week.timestamp() * 1000), int(end_last_week.timestamp() * 1000)
    elif p == 'mes':
        start_month = now_dt.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        return int(start_month.timestamp() * 1000), 0
    return 0, 0

def sync_funcionarios_from_api():
    try:
        now_ms = int(time.time() * 1000)
        with get_db_connection() as conn:
            cur = conn.cursor()
            # Sincroniza mecanicos de work_hours que ainda nao estao em funcionarios
            work_mecanicos = cur.execute('SELECT DISTINCT mecanico_steam_hex, mecanico_nome, cargo FROM work_hours WHERE mecanico_steam_hex != ""').fetchall()
            for hex_id, nome, cargo in work_mecanicos:
                clean_hex = hex_id.strip().lower()
                if clean_hex in IGNORED_STAFF_HEXES:
                    continue
                clean_nome = (nome or 'Mecanico').strip()
                clean_cargo = (cargo or 'aprendiz').strip().lower()

                cur.execute('''
                    INSERT INTO funcionarios (steam_hex, nome, avatar_url, ativo, last_synced_at)
                    VALUES (?, ?, '', 1, ?)
                    ON CONFLICT(steam_hex) DO UPDATE SET ativo = 1, nome = excluded.nome
                ''', (clean_hex, clean_nome, now_ms))

                cur.execute('''
                    INSERT INTO member_roles (steam_hex, cargo, updated_at, updated_by)
                    VALUES (?, ?, ?, 'Sistema')
                    ON CONFLICT(steam_hex) DO NOTHING
                ''', (clean_hex, clean_cargo, now_ms))
            conn.commit()

            # Enriquecer avatares da Steam em lote para qualquer funcionário novo
            try:
                sync_missing_steam_avatars()
            except Exception as e:
                safe_log(f"[Sync Funcionarios Interno] Falha ao atualizar avatares: {e}")
            
            cur.execute('SELECT COUNT(*) FROM funcionarios WHERE ativo = 1')
            total = cur.fetchone()[0]
            return True, total
    except Exception as e:
        safe_log(f"[Sync Funcionarios Interno] Erro: {e}")
        return False, 0

def sync_missing_steam_avatars():
    """Busca na Steam API em lote (até 100 IDs por vez) os avatares de funcionários que ainda estão sem foto."""
    if not STEAM_API_KEY:
        return 0
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            rows = cur.execute('SELECT steam_hex FROM funcionarios WHERE avatar_url IS NULL OR length(avatar_url) = 0').fetchall()
            if not rows:
                return 0

            hex_map = {}
            for (sh,) in rows:
                raw = sh.lower().replace('steam:', '').strip()
                try:
                    s64 = str(int(raw, 16))
                    hex_map[s64] = sh
                except Exception:
                    pass

            s64_list = list(hex_map.keys())
            if not s64_list:
                return 0

            updated = 0
            for i in range(0, len(s64_list), 100):
                batch = s64_list[i:i+100]
                url = f"https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key={STEAM_API_KEY}&steamids={','.join(batch)}"
                req = urllib.request.Request(url, headers={'User-Agent': 'MecBRP-OCR/2.7'})
                with urllib.request.urlopen(req, timeout=10) as resp:
                    if resp.status == 200:
                        data = json.loads(resp.read().decode('utf-8'))
                        players = data.get('response', {}).get('players', [])
                        for p in players:
                            sid = p.get('steamid')
                            avatar = p.get('avatarfull')
                            if sid in hex_map and avatar:
                                cur.execute('UPDATE funcionarios SET avatar_url = ? WHERE steam_hex = ?', (avatar, hex_map[sid]))
                                updated += 1
            conn.commit()
            if updated > 0:
                safe_log(f"[Steam Avatar Sync] {updated} avatares atualizados automaticamente da Steam API.")
            return updated
    except Exception as e:
        safe_log(f"[Steam Avatar Sync] Erro: {e}")
        return 0

def sync_invoices_from_discord(limit=200):
    CHANNEL_INVOICES = '1389258314818257049'
    token = os.environ.get('DISCORD_TOKEN')
    if not token:
        safe_log("[Sync Invoices] DISCORD_TOKEN não configurado. Sincronização histórica de faturas ignorada.")
        return 0

    headers = {
        'Authorization': token,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    }
    imported = 0
    before = None
    remaining = limit

    while remaining > 0:
        batch_size = min(100, remaining)
        url = f'https://discord.com/api/v9/channels/{CHANNEL_INVOICES}/messages?limit={batch_size}'
        if before:
            url += f'&before={before}'

        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=12) as resp:
                msgs = json.loads(resp.read().decode('utf-8'))
                if not msgs:
                    break
                for m in msgs:
                    msg_id = str(m.get('id', ''))
                    content = str(m.get('content', ''))
                    embeds = m.get('embeds', [])
                    ts_str = m.get('timestamp', '')
                    ts_ms = int(time.time() * 1000)
                    if ts_str:
                        try:
                            dt = datetime.datetime.fromisoformat(ts_str.replace('Z', '+00:00'))
                            ts_ms = int(dt.timestamp() * 1000)
                        except Exception:
                            pass
                    
                    emb_data = None
                    if embeds:
                        emb = embeds[0]
                        emb_data = {
                            'title': emb.get('title', ''),
                            'description': emb.get('description', ''),
                            'fields': [{'name': f.get('name', ''), 'value': f.get('value', '')} for f in emb.get('fields', [])]
                        }
                    
                    log_item = {
                        'id': msg_id,
                        'rawText': content,
                        'embed': emb_data,
                        'timestampMs': ts_ms,
                        'channelId': CHANNEL_INVOICES
                    }
                    res = process_live_discord_log(log_item)
                    if res.get('ok') and res.get('type') == 'fatura':
                        imported += 1

                before = msgs[-1].get('id')
                remaining -= len(msgs)
                if len(msgs) < batch_size:
                    break
        except Exception as e:
            safe_log(f"[Sync Invoices Error] {e}")
            break

    return True, imported

def fetch_steam_player_summary(steam_id_64: str):
    try:
        url = f"https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key={STEAM_API_KEY}&steamids={steam_id_64}"
        req = urllib.request.Request(url, headers={'User-Agent': 'MecBRP-OCR/2.7'})
        with urllib.request.urlopen(req, timeout=6) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode('utf-8'))
                players = data.get('response', {}).get('players', [])
                if players:
                    return players[0]
    except Exception as e:
        safe_log(f"[Steam API] Erro ao buscar player summary: {e}")
    return None

def verify_steam_openid_response(query_dict: dict):
    try:
        check_params = {k: v[0] for k, v in query_dict.items()}
        check_params['openid.mode'] = 'check_authentication'
        
        encoded_data = urllib.parse.urlencode(check_params).encode('utf-8')
        req = urllib.request.Request(
            'https://steamcommunity.com/openid/login',
            data=encoded_data,
            headers={
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'MecBRP-OCR/2.7'
            }
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            resp_text = resp.read().decode('utf-8')
            if 'is_valid:true' in resp_text:
                claimed_id = check_params.get('openid.claimed_id', '')
                steam_id_64 = claimed_id.split('/')[-1] if '/' in claimed_id else ''
                return True, steam_id_64
            else:
                safe_log(f"[OpenID] Assinatura invalida da Steam: {resp_text}")
    except Exception as e:
        safe_log(f"[OpenID] Erro na validacao de assinatura: {e}")
    return False, ''

def forward_to_discord_webhook(content: str, image_bytes: bytes = None, filename: str = 'veiculo.webp'):
    if not DISCORD_WEBHOOK_URL:
        return False, {"error": "Discord Webhook nao configurado na VPS"}

    try:
        if image_bytes:
            boundary = f"----WebKitFormBoundary{secrets.token_hex(16)}"
            body_parts = []
            
            payload_json = json.dumps({"content": content})
            body_parts.append(f"--{boundary}\r\n".encode('utf-8'))
            body_parts.append(b'Content-Disposition: form-data; name="payload_json"\r\n\r\n')
            body_parts.append(payload_json.encode('utf-8'))
            body_parts.append(b'\r\n')
            
            mime = 'image/webp' if filename.endswith('.webp') else 'image/jpeg'
            body_parts.append(f"--{boundary}\r\n".encode('utf-8'))
            body_parts.append(f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'.encode('utf-8'))
            body_parts.append(f'Content-Type: {mime}\r\n\r\n'.encode('utf-8'))
            body_parts.append(image_bytes)
            body_parts.append(b'\r\n')
            
            body_parts.append(f"--{boundary}--\r\n".encode('utf-8'))
            
            full_body = b''.join(body_parts)
            headers = {
                'Content-Type': f'multipart/form-data; boundary={boundary}',
                'User-Agent': 'MecBRP-Server/2.7'
            }
            req = urllib.request.Request(f"{DISCORD_WEBHOOK_URL}?wait=true", data=full_body, headers=headers, method='POST')
        else:
            json_body = json.dumps({"content": content}).encode('utf-8')
            headers = {
                'Content-Type': 'application/json',
                'User-Agent': 'MecBRP-Server/2.7'
            }
            req = urllib.request.Request(DISCORD_WEBHOOK_URL, data=json_body, headers=headers, method='POST')

        with urllib.request.urlopen(req, timeout=12) as resp:
            raw_body = resp.read().decode('utf-8').strip()
            resp_data = json.loads(raw_body) if raw_body else {}
            attachment = resp_data.get('attachments', [{}])[0] if resp_data.get('attachments') else {}
            return True, {
                "url": attachment.get('url'),
                "proxyUrl": attachment.get('proxy_url'),
                "filename": attachment.get('filename'),
                "messageId": resp_data.get('id')
            }
    except Exception as e:
        safe_log(f"[Discord Forward] Erro ao enviar para Discord: {e}")
        return False, {"error": str(e)}

def update_discord_webhook_message(message_id: str, content: str):
    if not DISCORD_WEBHOOK_URL or not message_id:
        return False, {"error": "Parametros invalidos"}

    try:
        url = f"{DISCORD_WEBHOOK_URL}/messages/{message_id}"
        json_body = json.dumps({"content": content}).encode('utf-8')
        headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'MecBRP-Server/2.7'
        }
        req = urllib.request.Request(url, data=json_body, headers=headers, method='PATCH')
        with urllib.request.urlopen(req, timeout=10) as resp:
            return True, {"ok": True}
    except Exception as e:
        safe_log(f"[Discord Patch] Erro ao editar mensagem: {e}")
        return False, {"error": str(e)}

def background_tasks_loop():
    sync_interval_seconds = 1800
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

def clean_member_name(name_str):
    if not name_str:
        return 'Mecanico'
    import re
    cleaned = str(name_str).strip()
    cleaned = re.sub(r'[*_~`]+', '', cleaned)
    cleaned = re.sub(r'<@!?\d+>', '', cleaned)
    # Remove prefixos como [OFM|Apr], [OFM|Prof], [Aprendiz], etc.
    cleaned = re.sub(r'^@?\[[^\]]*\]\s*', '', cleaned)
    # Remove tags soltas no final ou início
    cleaned = re.sub(r'^\s*\|\s*', '', cleaned)
    cleaned = cleaned.strip()
    return cleaned if cleaned else 'Mecanico'

def guess_category(item_name: str) -> str:
    lower = str(item_name).lower()
    if any(k in lower for k in ['oleo', 'óleo', 'aditivo', 'agua', 'água', 'fluido', 'gasolina', 'combustivel']):
        return 'fluidos'
    if any(k in lower for k in ['motor', 'pistao', 'pistão', 'valvula', 'válvula', 'bloco', 'cabecote', 'cabeçote', 'junta', 'vela', 'correia', 'radiador']):
        return 'motor'
    if any(k in lower for k in ['freio', 'disco', 'pastilha', 'abs', 'carbon', 'ceramic']):
        return 'freios'
    if any(k in lower for k in ['suspensao', 'suspensão', 'mola', 'amortecedor', 'coilovers']):
        return 'suspensao'
    if any(k in lower for k in ['pneu', 'rodas', 'aro', 'drift', 'slick', 'semi']):
        return 'pneus'
    if any(k in lower for k in ['turbo', 'intercooler', 'escape', 'nitro', 'racing', 'chip', 'reprogramacao', 'reprogramação', 'direcao', 'direção']):
        return 'performance'
    if any(k in lower for k in ['kit', 'chave', 'martelinho', 'ferramenta', 'scanner', 'guincho', 'macaco']):
        return 'ferramentas'
    return 'outros'

IGNORED_INVENTORY_ITEMS = {
    'sanduiche', 'sanduiches', 'sanduíche', 'sanduíches',
    'redbull', 'red bull', 'energetico', 'energético', 'energeticos', 'energéticos',
    'agua mineral', 'água mineral', 'hamburguer', 'hambúrguer', 'pizza', 'pizzas',
    'refrigerante', 'refrigerantes', 'suco', 'sucos', 'lanche', 'lanches',
    'salgadinho', 'salgadinhos', 'cerveja', 'cervejas', 'cafe', 'café',
    'marlboro', 'cigarro', 'cigarros', 'erva', 'dinheiro sujo', 'lockpick', 'algema', 'algemas',
    'dorflex', 'remedio', 'remédio', 'bandagem', 'bandagens', 'kit medico', 'kit médico'
}

def is_ignored_item(item_name: str) -> bool:
    if not item_name:
        return False
    lower = str(item_name).lower().strip()
    nfkd = unicodedata.normalize('NFKD', lower)
    clean = "".join([c for c in nfkd if not unicodedata.combining(c)]).strip()
    for ign in IGNORED_INVENTORY_ITEMS:
        ign_nfkd = unicodedata.normalize('NFKD', ign)
        ign_clean = "".join([c for c in ign_nfkd if not unicodedata.combining(c)]).strip()
        if ign_clean == clean or ign_clean in clean:
            return True
    return False

def normalize_item_tokens(text: str) -> set:
    if not text:
        return set()
    nfkd = unicodedata.normalize('NFKD', str(text))
    clean = "".join([c for c in nfkd if not unicodedata.combining(c)]).lower()
    clean = re.sub(r'[^a-z0-9\s]', ' ', clean)
    words = clean.split()
    tokens = set()
    stop_words = {'de', 'do', 'da', 'dos', 'das', 'para', 'o', 'a', 'os', 'as', 'e', 'em', 'um', 'uma'}
    for w in words:
        if w in stop_words:
            continue
        if w.endswith('s') and len(w) > 3 and not w.endswith('ss'):
            w = w[:-1]
        tokens.add(w)
    return tokens

def detect_role_from_text(text: str) -> str:
    if not text:
        return 'aprendiz'
    
    # 1. Padrões específicos de tag de facção/oficina: [OFM|Apr], [OFM | Aux], [OFM - Prof], etc.
    ofm_m = re.search(r'\[\s*(?:ofm|mec|mecanica|oficina)\s*[\/\|\-\–]\s*([a-zà-ú]+)\s*\]', text, re.IGNORECASE)
    if ofm_m:
        val = ofm_m.group(1).lower()
        if val.startswith('apr') or val.startswith('nov') or val.startswith('est'): return 'aprendiz'
        if val.startswith('aux'): return 'auxiliar'
        if val.startswith('prof'): return 'profissional'
        if val.startswith('sup'): return 'supervisor'
        if val.startswith('ger') or val.startswith('sub'): return 'gerente'
        if val.startswith('don') or val.startswith('dir'): return 'dono'

    # 2. Checagem direta por colchetes com qualquer prefixo ou direto: [Apr], [Aux], [Prof], [Sup], [Aprendiz], etc.
    bracket_m = re.search(r'\[(?:[^\]]*[\/\|\-\–]\s*)?(dono|diretor|gerente|subgerente|supervisor|supervisora|profissional|auxiliar|aprendiz|estagi[aá]rio|novato|sup|prof|aux|apr|dir|ger)\s*\]', text, re.IGNORECASE)
    if bracket_m:
        val = bracket_m.group(1).lower()
        if val in ('dono', 'diretor', 'dir'): return 'dono'
        if val in ('gerente', 'subgerente', 'ger'): return 'gerente'
        if val in ('supervisor', 'supervisora', 'sup'): return 'supervisor'
        if val in ('profissional', 'prof'): return 'profissional'
        if val in ('auxiliar', 'aux'): return 'auxiliar'
        if val in ('aprendiz', 'estagiario', 'estagiário', 'novato', 'apr'): return 'aprendiz'

    # 3. Checagem por delimitadores / | -
    delim_m = re.search(r'[\/\|\-\–]\s*(dono|diretor|gerente|subgerente|supervisor|supervisora|profissional|auxiliar|aprendiz|estagi[aá]rio|novato|sup|prof|aux|apr|dir|ger)\b', text, re.IGNORECASE)
    if delim_m:
        val = delim_m.group(1).lower()
        if val in ('dono', 'diretor', 'dir'): return 'dono'
        if val in ('gerente', 'subgerente', 'ger'): return 'gerente'
        if val in ('supervisor', 'supervisora', 'sup'): return 'supervisor'
        if val in ('profissional', 'prof'): return 'profissional'
        if val in ('auxiliar', 'aux'): return 'auxiliar'
        if val in ('aprendiz', 'estagiario', 'estagiário', 'novato', 'apr'): return 'aprendiz'

    # 4. Checagem por campo "Cargo: Profissional" ou similar
    field_m = re.search(r'(?:cargo|fun[cç][aã]o|patente)\s*[:=]\s*(dono|diretor|gerente|subgerente|supervisor|supervisora|profissional|auxiliar|aprendiz|estagi[aá]rio|novato|sup|prof|aux|apr)\b', text, re.IGNORECASE)
    if field_m:
        val = field_m.group(1).lower()
        if val in ('dono', 'diretor', 'dir'): return 'dono'
        if val in ('gerente', 'subgerente', 'ger'): return 'gerente'
        if val in ('supervisor', 'supervisora', 'sup'): return 'supervisor'
        if val in ('profissional', 'prof'): return 'profissional'
        if val in ('auxiliar', 'aux'): return 'auxiliar'
        if val in ('aprendiz', 'estagiario', 'estagiário', 'novato', 'apr'): return 'aprendiz'

    # 5. Checagem de palavras isoladas completas com limites de palavra \b
    if re.search(r'\b(dono|diretor)\b', text, re.IGNORECASE):
        return 'dono'
    if re.search(r'\b(gerente|subgerente|gerencia)\b', text, re.IGNORECASE):
        return 'gerente'
    if re.search(r'\b(supervisor|supervisora)\b', text, re.IGNORECASE):
        return 'supervisor'
    if re.search(r'\b(profissional)\b', text, re.IGNORECASE):
        return 'profissional'
    if re.search(r'\b(auxiliar)\b', text, re.IGNORECASE):
        return 'auxiliar'
    if re.search(r'\b(aprendiz|estagiario|estagiário|novato)\b', text, re.IGNORECASE):
        return 'aprendiz'

    # Padrão absoluto caso nada seja detectado: sempre APRENDIZ
    return 'aprendiz'

def match_inventory_item(item_name: str, full_content: str, inv_rows: list):
    name_tokens = normalize_item_tokens(item_name)
    content_tokens = normalize_item_tokens(full_content)
    
    best_match = None
    best_score = 0
    
    for i_id, i_nome, i_qtd in inv_rows:
        inv_tokens = normalize_item_tokens(i_nome)
        if not inv_tokens:
            continue
        
        if name_tokens == inv_tokens:
            return (i_id, i_nome, i_qtd)
        
        if name_tokens and (name_tokens.issubset(inv_tokens) or inv_tokens.issubset(name_tokens)):
            score = len(name_tokens.intersection(inv_tokens)) / max(len(name_tokens), len(inv_tokens))
            if score > best_score:
                best_score = score
                best_match = (i_id, i_nome, i_qtd)
                
    if best_match and best_score >= 0.5:
        return best_match
        
    for i_id, i_nome, i_qtd in inv_rows:
        inv_tokens = normalize_item_tokens(i_nome)
        if inv_tokens and inv_tokens.issubset(content_tokens):
            return (i_id, i_nome, i_qtd)
            
    return None

def process_live_discord_log(log_item: dict):
    if not isinstance(log_item, dict):
        return {"ok": False, "error": "Invalid log item"}
    
    raw = log_item.get('rawText', '') or ''
    embed = log_item.get('embed') or {}
    description = embed.get('description', '') or ''
    title = embed.get('title', '') or ''
    fields_text = '\n'.join([f"{f.get('name')}: {f.get('value')}" for f in embed.get('fields', [])])
    full_content = f"{raw}\n{title}\n{description}\n{fields_text}".strip()
    lower = full_content.lower()

    author_user = str(log_item.get('author') or '')
    author_nick = str(log_item.get('authorNick') or '')
    author_global = str(log_item.get('authorGlobalName') or '')
    author_id = str(log_item.get('authorId') or '')

    ts_ms = int(log_item.get('timestampMs') or time.time() * 1000)
    dt = datetime.datetime.fromtimestamp(ts_ms / 1000.0, BRT_TZ)
    data_str = dt.strftime('%d/%m/%Y')
    hora_str = dt.strftime('%H:%M')
    hour = dt.hour
    turno = 'noite'
    if 0 <= hour < 6: turno = 'madrugada'
    elif 6 <= hour < 12: turno = 'manha'
    elif 12 <= hour < 18: turno = 'tarde'

    # 1. CHECAGEM DE BAÚ
    is_retirada = any(k in lower for k in ['retirou', 'retirada', 'pegou', 'sacou', 'removeu'])
    is_devolucao = any(k in lower for k in ['depositou', 'guardou', 'colocou', 'devolveu', 'inseriu', 'adicionou', 'deposito'])

    if is_retirada or is_devolucao:
        import re
        qtd = 1
        item_nome = ''

        # Limpa markdown e formatacoes para nao quebrar regex com ** ou __
        clean_content = re.sub(r'[*_~`]+', ' ', full_content)
        clean_content = re.sub(r'[ \t]+', ' ', clean_content)

        m = re.search(r'(?:RETIROU|DEPOSITOU|GUARDOU|COLOCOU|DEVOLVEU|INSERIU|PEGOU|REMOVEU)\s*(?:O\s*ITEM)?\s*:\s*(\d[\d\.\,]*)\s*(?:x|un|l)?\s+([^\n\r]+)', clean_content, re.IGNORECASE)
        if not m:
            m = re.search(r'(?:Item|Peça|Peca)\s*:\s*(\d[\d\.\,]*)\s*(?:x|un|l)?\s+([^\n\r]+)', clean_content, re.IGNORECASE)
        if not m:
            m = re.search(r'(?:Retirou|Devolveu|Pegou|Depositou|Guardou)\s+(\d[\d\.\,]*)\s*(?:x|un|l)?\s+([^\n\r]+)', clean_content, re.IGNORECASE)
        if not m:
            item_m = re.search(r'(?:Item|Peça|Peca|Item\s*Nome)\s*:\s*([^\n\r]+)', clean_content, re.IGNORECASE)
            qtd_m = re.search(r'(?:Quantidade|Qtd|Valor|Qtd\.)\s*:\s*(\d[\d\.\,]*)', clean_content, re.IGNORECASE)
            if item_m:
                item_nome = item_m.group(1).strip().lstrip('xX ')
                if qtd_m:
                    q_str = qtd_m.group(1).replace('.', '').replace(',', '')
                    qtd = int(q_str) if q_str.isdigit() else 1
        
        if m:
            q_str = m.group(1).replace('.', '').replace(',', '')
            qtd = int(q_str) if q_str.isdigit() else 1
            item_nome = m.group(2).strip().lstrip('xX ')

        if item_nome:
            item_nome = re.sub(r'\s*\(\s*x?\d+.*?\)', '', item_nome).strip()

        # Descarta itens pessoais / comida / bebida
        if is_ignored_item(item_nome):
            return {"ok": True, "ignored": True, "item": item_nome, "reason": "item_ignorado"}

        steam_hex = ''
        hex_m = re.search(r'HEX:\s*(steam:[0-9a-fA-F]+)', full_content, re.IGNORECASE)
        if hex_m:
            steam_hex = hex_m.group(1).strip().lower()

        mecanico_nome = ''
        name_m = re.search(r'(?:O\s+)?(?:jogador|mecanico|mecânico|funcionario|funcionário|usuario|usuário|nome|autor):\s*([^\n\r]+)', full_content, re.IGNORECASE)
        if name_m:
            mecanico_nome = clean_member_name(name_m.group(1))
        
        with get_db_connection() as conn:
            cursor = conn.cursor()
            if steam_hex and not mecanico_nome:
                cursor.execute('SELECT nome FROM funcionarios WHERE LOWER(steam_hex) = ?', (steam_hex,))
                r = cursor.fetchone()
                if r: mecanico_nome = clean_member_name(r[0])

            if not mecanico_nome:
                mecanico_nome = 'Mecanico'

            cursor.execute('SELECT id, nome, quantidade_atual FROM inventory')
            inv_rows = cursor.fetchall()
            matched_item = match_inventory_item(item_nome, full_content, inv_rows)

            if not matched_item and item_nome:
                new_item_id = f"item-auto-{int(ts_ms)}-{secrets.token_hex(2)}"
                new_cat = guess_category(item_nome)
                new_unidade = 'L' if any(k in item_nome.lower() for k in ['oleo', 'óleo', 'agua', 'água', 'litro']) else 'un'
                initial_qtd = qtd if is_devolucao else 0
                cursor.execute('''
                    INSERT INTO inventory (id, nome, categoria, quantidade_atual, meta_minima, unidade, descricao, ultima_atualizacao, atualizado_por)
                    VALUES (?, ?, ?, ?, 0, ?, 'Item cadastrado automaticamente via log do Discord', ?, ?)
                ''', (new_item_id, item_nome, new_cat, initial_qtd, new_unidade, ts_ms, mecanico_nome))
                matched_item = (new_item_id, item_nome, initial_qtd)

            log_id = log_item.get('id', '')
            tx_id = f"trans-{log_id}" if log_id else f"trans-{steam_hex}-{ts_ms}"

            cursor.execute('SELECT id FROM inventory_transactions WHERE id = ?', (tx_id,))
            if not cursor.fetchone():
                item_id_used = matched_item[0] if matched_item else f"item-auto-{secrets.token_hex(3)}"
                item_nome_used = matched_item[1] if matched_item else (item_nome or 'Item de Mecânica')
                tipo = 'devolucao' if is_devolucao else 'retirada'

                cursor.execute('''
                    INSERT INTO inventory_transactions (id, item_id, item_nome, tipo, quantidade, mecanico_nome, mecanico_steam_hex, data_hora_str, timestamp)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (tx_id, item_id_used, item_nome_used, tipo, qtd, mecanico_nome, steam_hex, f"{data_str} | {hora_str}", ts_ms))

                if matched_item:
                    curr_qtd = matched_item[2]
                    new_qtd = max(0, curr_qtd - qtd) if is_retirada else curr_qtd + qtd
                    cursor.execute('''
                        UPDATE inventory SET quantidade_atual = ?, ultima_atualizacao = ?, atualizado_por = ?
                        WHERE id = ?
                    ''', (new_qtd, ts_ms, mecanico_nome, matched_item[0]))
                conn.commit()
                return {"ok": True, "type": "inventory", "item": item_nome_used, "qtd": qtd, "action": tipo}

    # 2. CHECAGEM DE PONTO
    is_entrada = 'entrou em serviço' in lower or 'entrou em servico' in lower or '🟢' in full_content
    is_saida = 'saiu de serviço' in lower or 'saiu de servico' in lower or '🔴' in full_content or 'tempo trabalhado' in lower

    if is_entrada or is_saida:
        import re
        steam_hex = ''
        hex_m = re.search(r'HEX:\s*(steam:[0-9a-fA-F]+)', full_content, re.IGNORECASE) or re.search(r'\b(steam:[0-9a-fA-F]{10,20})\b', full_content, re.IGNORECASE)
        if hex_m:
            steam_hex = hex_m.group(1).strip().lower()

        if steam_hex in IGNORED_STAFF_HEXES:
            return {"ok": True, "ignored": True, "reason": "staff_ignorado"}

        nome = ''
        name_m = re.search(r'(?:O\s+)?(?:mecanico|mecânico|funcionario|funcionário|jogador|nome|autor):\s*([^\n\r]+)', full_content, re.IGNORECASE)
        if name_m:
            nome = clean_member_name(name_m.group(1))
        
        discord_tag = ''
        disc_m = re.search(r'Discord:\s*([^\n\r]+)', full_content, re.IGNORECASE)
        if disc_m: discord_tag = disc_m.group(1).strip()

        with get_db_connection() as conn:
            cursor = conn.cursor()
            if steam_hex and not nome:
                cursor.execute('SELECT nome FROM funcionarios WHERE LOWER(steam_hex) = ?', (steam_hex,))
                r = cursor.fetchone()
                if r: nome = clean_member_name(r[0])
            if not nome: nome = 'Mecanico'

            cargo = None
            if steam_hex:
                cursor.execute('SELECT cargo FROM member_roles WHERE LOWER(steam_hex) = ?', (steam_hex,))
                r = cursor.fetchone()
                if r and r[0]:
                    cargo = r[0]

            member_discord_id = extract_member_discord_id(discord_tag, full_content, author_id, author_user)

            if not cargo:
                combined_text = f"{author_nick} {nome} {author_global} {author_user} {discord_tag} {full_content}"
                cargo = detect_role_from_text(combined_text)
                if steam_hex:
                    cursor.execute('''
                        INSERT INTO member_roles (steam_hex, cargo, updated_at, updated_by, discord_id)
                        VALUES (?, ?, ?, 'Discord Log', ?)
                        ON CONFLICT(steam_hex) DO UPDATE SET
                            cargo = CASE WHEN member_roles.cargo IS NULL OR member_roles.cargo = '' THEN excluded.cargo ELSE member_roles.cargo END,
                            discord_id = CASE 
                                WHEN excluded.discord_id != '' THEN excluded.discord_id
                                WHEN member_roles.discord_id IN ('1389359764806303867', '1389366500225454120') THEN ''
                                ELSE member_roles.discord_id
                            END
                    ''', (steam_hex, cargo, ts_ms, member_discord_id))
            elif steam_hex and member_discord_id:
                cursor.execute('''
                    UPDATE member_roles
                    SET discord_id = ?, updated_at = ?
                    WHERE LOWER(steam_hex) = ? AND (discord_id IS NULL OR discord_id = '' OR discord_id IN ('1389359764806303867', '1389366500225454120'))
                ''', (member_discord_id, ts_ms, steam_hex.lower()))

            if is_entrada:
                tc_id = f"tc_{steam_hex}_{ts_ms}"
                cursor.execute('''
                    INSERT INTO work_hours (id, mecanico_steam_hex, mecanico_nome, mecanico_discord, cargo, entrada_timestamp, duracao_minutos, status, turno, data_str, horario_entrada_str)
                    VALUES (?, ?, ?, ?, ?, ?, 0, 'aberto', ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET mecanico_nome = excluded.mecanico_nome
                ''', (tc_id, steam_hex, nome, discord_tag, cargo, ts_ms, turno, data_str, hora_str))
                conn.commit()
                return {"ok": True, "type": "work_hours", "action": "entrada", "nome": nome}
            else:
                cursor.execute('''
                    SELECT id, entrada_timestamp FROM work_hours
                    WHERE LOWER(mecanico_steam_hex) = ? AND status = 'aberto'
                    ORDER BY entrada_timestamp DESC LIMIT 1
                ''', (steam_hex,))
                open_row = cursor.fetchone()
                if open_row:
                    open_id, entrada_ms = open_row
                    duracao_min = max(1, min(840, round((ts_ms - entrada_ms) / 60000)))
                    cursor.execute('''
                        UPDATE work_hours
                        SET saida_timestamp = ?, duracao_minutos = ?, status = 'finalizado', horario_saida_str = ?
                        WHERE id = ?
                    ''', (ts_ms, duracao_min, hora_str, open_id))
                    conn.commit()
                    return {"ok": True, "type": "work_hours", "action": "saida_fechada", "duracao": duracao_min, "nome": nome}
                else:
                    duracao_min = 1
                    t_match = re.search(r'Tempo trabalhado:\s*(\d+)\s*(?:hora|horas|h)\s*(?:e\s*)?(\d+)?\s*(?:minuto|minutos|min)?', full_content, re.IGNORECASE)
                    if t_match:
                        h = int(t_match.group(1))
                        m_min = int(t_match.group(2)) if t_match.group(2) else 0
                        duracao_min = h * 60 + m_min
                    else:
                        t_min_match = re.search(r'Tempo trabalhado:\s*(\d+)\s*(?:minuto|minutos|min)', full_content, re.IGNORECASE)
                        if t_min_match:
                            duracao_min = int(t_min_match.group(1))
                    
                    entrada_ms = ts_ms - duracao_min * 60000
                    ent_dt = datetime.datetime.fromtimestamp(entrada_ms / 1000.0, BRT_TZ)
                    ent_str = ent_dt.strftime('%H:%M')
                    tc_id = f"tc_{steam_hex}_{entrada_ms}"

                    cursor.execute('''
                        INSERT INTO work_hours (id, mecanico_steam_hex, mecanico_nome, mecanico_discord, cargo, entrada_timestamp, saida_timestamp, duracao_minutos, status, turno, data_str, horario_entrada_str, horario_saida_str)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'finalizado', ?, ?, ?, ?)
                        ON CONFLICT(id) DO UPDATE SET duracao_minutos = excluded.duracao_minutos, status = 'finalizado'
                    ''', (tc_id, steam_hex, nome, discord_tag, cargo, entrada_ms, ts_ms, duracao_min, turno, data_str, ent_str, hora_str))
                    conn.commit()
                    return {"ok": True, "type": "work_hours", "action": "saida_direta", "duracao": duracao_min, "nome": nome}

    # 3. CHECAGEM DE FATURAS (CANAL DE FATURAS OU EMBED DE FATURA)
    is_fatura_registro = 'registro fatura' in lower or (('funcionário:' in lower or 'funcionario:' in lower) and 'enviou:' in lower)
    is_fatura_paga = 'fatura paga' in lower or ('devedor:' in lower and 'pagou:' in lower)

    if is_fatura_registro or is_fatura_paga:
        import re
        tipo_registro = 'registro' if is_fatura_registro else 'paga'

        # Limpa markdown e duplos espaços
        clean_content = re.sub(r'[*_~`]+', ' ', full_content)
        clean_content = re.sub(r'[ \t]+', ' ', clean_content)

        func_nome = ''
        func_steam_hex = ''
        func_discord = ''

        m_func = re.search(r'(?:O\s+)?(?:Funcionário|Funcionario)\s*:\s*([^\n\r]+?)(?:\s+da\s+society|\s+da\s+oficina|\n|$)', clean_content, re.IGNORECASE)
        if m_func:
            raw_fname = m_func.group(1).strip()
            raw_fname = re.sub(r'\s+da\s+society[_\s]*mechanic.*', '', raw_fname, flags=re.IGNORECASE).strip()
            func_nome = clean_member_name(raw_fname)

        hexes = re.findall(r'HEX:\s*(steam:[0-9a-fA-F]+)', clean_content, re.IGNORECASE)
        discords = re.findall(r'Discord:\s*([^\n\r]+)', clean_content, re.IGNORECASE)

        if hexes:
            func_steam_hex = hexes[0].strip().lower()
        if discords:
            func_discord = discords[0].strip()

        cliente_nome = ''
        cliente_steam_hex = hexes[1].strip().lower() if len(hexes) > 1 else ''
        cliente_discord = discords[1].strip() if len(discords) > 1 else ''

        m_cliente = re.search(r'(?:Para o jogador|Devedor)\s*:\s*([^\n\r]+)', clean_content, re.IGNORECASE)
        if m_cliente:
            cliente_nome = clean_member_name(m_cliente.group(1))

        servicos = []
        guincho_cidade_qtd = 0
        guincho_fora_qtd = 0
        valor_guincho = 0

        lines = [l.strip() for l in clean_content.split('\n') if l.strip()]
        for line in lines:
            m_item = re.match(r'^[•\*\-]\s*([^:]+?)\s*:\s*R\$?\s*([\d\.\,]+)', line, re.IGNORECASE)
            if not m_item:
                m_item = re.match(r'^[•\*\-]\s*([^:]+)', line, re.IGNORECASE)
            if m_item:
                item_desc = m_item.group(1).strip()
                val_str = m_item.group(2).replace('.', '').replace(',', '') if len(m_item.groups()) > 1 and m_item.group(2) else '0'
                item_val = int(val_str) if val_str.isdigit() else 0
                item_lower = item_desc.lower()
                if 'guinchar fora' in item_lower or 'guincho fora' in item_lower:
                    guincho_fora_qtd += 1
                    valor_guincho += item_val
                elif 'guinchar na cidade' in item_lower or 'guincho na cidade' in item_lower or 'guinchar cidade' in item_lower or 'guincho cidade' in item_lower:
                    guincho_cidade_qtd += 1
                    valor_guincho += item_val
                servicos.append({'nome': item_desc, 'valor': item_val})

        valor_total = 0
        m_total = re.search(r'Total\s*:\s*R\$?\s*([\d\.\,]+)', clean_content, re.IGNORECASE)
        if m_total:
            t_clean = m_total.group(1).replace('.', '').replace(',', '')
            if t_clean.isdigit():
                valor_total = int(t_clean)
        elif servicos:
            valor_total = sum(s['valor'] for s in servicos)

        msg_id = str(log_item.get('id') or f"fat_{ts_ms}_{secrets.token_hex(3)}")

        with get_db_connection() as conn:
            cursor = conn.cursor()
            if func_steam_hex and not func_nome:
                cursor.execute('SELECT nome FROM funcionarios WHERE LOWER(steam_hex) = ?', (func_steam_hex,))
                r = cursor.fetchone()
                if r: func_nome = clean_member_name(r[0])
            if not func_nome:
                func_nome = 'Mecânico'

            if func_steam_hex and func_nome and func_nome != 'Mecânico' and func_steam_hex not in IGNORED_STAFF_HEXES:
                cursor.execute('''
                    INSERT INTO funcionarios (steam_hex, nome, avatar_url, ativo, last_synced_at)
                    VALUES (?, ?, '', 1, ?)
                    ON CONFLICT(steam_hex) DO UPDATE SET ativo = 1, nome = excluded.nome
                ''', (func_steam_hex, func_nome, ts_ms))

                fat_member_discord_id = extract_member_discord_id(func_discord, full_content, author_id, author_user)
                cursor.execute('SELECT cargo, discord_id FROM member_roles WHERE LOWER(steam_hex) = ?', (func_steam_hex,))
                mr_row = cursor.fetchone()
                if not mr_row:
                    fat_role = detect_role_from_text(f"{author_nick} {func_nome} {author_global} {author_user} {func_discord} {full_content}")
                    cursor.execute('''
                        INSERT INTO member_roles (steam_hex, cargo, updated_at, updated_by, discord_id)
                        VALUES (?, ?, ?, 'Discord Log', ?)
                        ON CONFLICT(steam_hex) DO NOTHING
                    ''', (func_steam_hex, fat_role, ts_ms, fat_member_discord_id))
                elif fat_member_discord_id and (not mr_row[1] or mr_row[1] in DISCORD_BOT_IDS):
                    cursor.execute('''
                        UPDATE member_roles SET discord_id = ?, updated_at = ? WHERE LOWER(steam_hex) = ?
                    ''', (fat_member_discord_id, ts_ms, func_steam_hex))

            cursor.execute('''
                INSERT INTO faturas (
                    id, funcionario_nome, funcionario_steam_hex, funcionario_discord,
                    cliente_nome, cliente_steam_hex, cliente_discord,
                    servicos_json, valor_total, valor_guincho, tipo_registro,
                    guincho_cidade_qtd, guincho_fora_qtd,
                    timestamp, data_str, horario_str
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    funcionario_nome = excluded.funcionario_nome,
                    funcionario_steam_hex = excluded.funcionario_steam_hex,
                    servicos_json = excluded.servicos_json,
                    valor_total = excluded.valor_total,
                    valor_guincho = excluded.valor_guincho,
                    guincho_cidade_qtd = excluded.guincho_cidade_qtd,
                    guincho_fora_qtd = excluded.guincho_fora_qtd
            ''', (
                msg_id, func_nome, func_steam_hex, func_discord,
                cliente_nome, cliente_steam_hex, cliente_discord,
                json.dumps(servicos, ensure_ascii=False), valor_total, valor_guincho, tipo_registro,
                guincho_cidade_qtd, guincho_fora_qtd,
                ts_ms, data_str, hora_str
            ))
            conn.commit()

        return {
            "ok": True,
            "type": "fatura",
            "action": tipo_registro,
            "funcionario": func_nome,
            "guincho_cidade": guincho_cidade_qtd,
            "guincho_fora": guincho_fora_qtd,
            "valor_total": valor_total
        }

    return {"ok": True, "ignored": True}

def is_origin_allowed(origin: str) -> bool:
    if not origin:
        return False
    for o in ALLOWED_ORIGINS:
        if origin == o or origin.startswith(o) or o in origin:
            return True
    return any(domain in origin for domain in ('gbrdev.net', 'neco.lat', 'netlify.app', 'localhost', '127.0.0.1'))

class TelemetryHandler(BaseHTTPRequestHandler):
    def _send_cors_headers(self):
        origin = self.headers.get('Origin', '')
        if origin and is_origin_allowed(origin):
            self.send_header('Access-Control-Allow-Origin', origin)
            self.send_header('Vary', 'Origin')
        elif not origin:
            self.send_header('Access-Control-Allow-Origin', APP_BASE_URL)
        else:
            self.send_header('Access-Control-Allow-Origin', APP_BASE_URL)
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Secret, X-Session-Token')
        self.send_header('Access-Control-Allow-Credentials', 'true')

    def _get_client_ip(self):
        forwarded = self.headers.get('X-Forwarded-For')
        if forwarded:
            return forwarded.split(',')[0].strip()
        real_ip = self.headers.get('X-Real-IP')
        if real_ip:
            return real_ip.strip()
        return self.client_address[0] if self.client_address else '127.0.0.1'

    def do_OPTIONS(self):
        self.send_response(204)
        self._send_cors_headers()
        self.end_headers()

    def _get_auth_session(self):
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

    def _get_session_role(self, session):
        if not session:
            return 'profissional'
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT cargo FROM member_roles WHERE LOWER(steam_hex) = LOWER(?)', (session['steam_hex'],))
            row = cursor.fetchone()
            if row and row[0]:
                return row[0]
        master_hexes = ['steam:admin', 'steam:11000014178ef1d', 'steam:110000108db9dcd', 'steam:1100001471c8302', 'steam:1100001493e69fd']
        if session['steam_hex'].lower() in master_hexes:
            return 'dono'
        return 'profissional'

    def _is_manager_or_dono(self, session, secret_provided=None):
        if secret_provided and secret_provided == ADMIN_SECRET:
            return True
        if not session:
            return False
        master_hexes = ['steam:admin', 'steam:11000014178ef1d', 'steam:110000108db9dcd', 'steam:1100001471c8302', 'steam:1100001493e69fd']
        if session.get('steam_hex', '').lower() in master_hexes:
            return True
        role = str(self._get_session_role(session) or '').lower()
        return role in ('dono', 'gerente', 'diretor', 'supervisor', 'subgerente', 'lider')

    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip('/')
        query_params = parse_qs(parsed.query)
        client_ip = self._get_client_ip()

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

        if path.endswith('/auth/steam/callback'):
            try:
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
                    cursor.execute('SELECT nome, avatar_url FROM funcionarios WHERE LOWER(steam_hex) = LOWER(?) AND ativo = 1', (steam_hex,))
                    row = cursor.fetchone()
                    if row:
                        mechanic_name = row[0]
                        avatar_url = row[1]
                    else:
                        # Verifica se já está em member_roles (somente cargo)
                        cursor.execute('SELECT cargo FROM member_roles WHERE LOWER(steam_hex) = LOWER(?)', (steam_hex,))
                        mr_row = cursor.fetchone()

                        # Verifica se já possui registros de ponto em work_hours
                        cursor.execute('SELECT mecanico_nome, cargo FROM work_hours WHERE LOWER(mecanico_steam_hex) = LOWER(?) ORDER BY entrada_timestamp DESC LIMIT 1', (steam_hex,))
                        wh_row = cursor.fetchone()
                        if wh_row and wh_row[0]:
                            mechanic_name = wh_row[0]
                            auto_role = (mr_row[0] if mr_row else None) or wh_row[1] or 'auxiliar'
                            cursor.execute('''
                                INSERT INTO member_roles (steam_hex, cargo, updated_at, updated_by)
                                VALUES (?, ?, ?, 'Sistema')
                                ON CONFLICT(steam_hex) DO NOTHING
                            ''', (steam_hex, auto_role, int(time.time()*1000)))
                        elif mr_row:
                            # Se tem cargo atribuído por admin mas ainda não bateu ponto, busca o nome na Steam
                            p_info = fetch_steam_player_summary(steam_id_64)
                            if p_info and p_info.get('personaname'):
                                mechanic_name = p_info.get('personaname')

                        if mechanic_name:
                            cursor.execute('''
                                INSERT INTO funcionarios (steam_hex, nome, avatar_url, ativo, last_synced_at)
                                VALUES (?, ?, '', 1, ?)
                                ON CONFLICT(steam_hex) DO UPDATE SET ativo = 1, nome = excluded.nome
                            ''', (steam_hex, mechanic_name, int(time.time()*1000)))
                            conn.commit()

                if not mechanic_name:
                    sync_funcionarios_from_api()
                    with get_db_connection() as conn:
                        cursor = conn.cursor()
                        cursor.execute('SELECT nome, avatar_url FROM funcionarios WHERE LOWER(steam_hex) = LOWER(?) AND ativo = 1', (steam_hex,))
                        row = cursor.fetchone()
                        if row:
                            mechanic_name = row[0]
                            avatar_url = row[1]

                if not mechanic_name:
                    self.send_response(302)
                    self.send_header('Location', f"{APP_BASE_URL}/#auth_error=not_authorized&steamHex={urllib.parse.quote(steam_hex)}")
                    self.end_headers()
                    return

                player_info = fetch_steam_player_summary(steam_id_64)
                if player_info and player_info.get('avatarfull'):
                    avatar_url = player_info.get('avatarfull')
                    with get_db_connection() as conn:
                        cursor = conn.cursor()
                        cursor.execute('UPDATE funcionarios SET avatar_url = ? WHERE steam_hex = ?', (avatar_url, steam_hex))
                        conn.commit()

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

                role = self._get_session_role({'steam_hex': steam_hex})
                redirect_target = (
                    f"{APP_BASE_URL}/#token={session_token}"
                    f"&nome={urllib.parse.quote(mechanic_name)}"
                    f"&steamHex={urllib.parse.quote(steam_hex)}"
                    f"&avatar={urllib.parse.quote(avatar_url or '')}"
                    f"&role={urllib.parse.quote(role)}"
                )
                self.send_response(302)
                self.send_header('Location', redirect_target)
                self.end_headers()
                return
            except Exception as e:
                safe_log(f"[Steam Callback Error] Excecao: {e}")
                self.send_response(302)
                self.send_header('Location', f"{APP_BASE_URL}/#auth_error=server_error")
                self.end_headers()
                return

        if path.endswith('/auth/me'):
            session = self._get_auth_session()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Cache-Control', 'no-cache, no-store')
            self._send_cors_headers()
            self.end_headers()
            if session:
                master_hexes = ['steam:11000014178ef1d', 'steam:110000108db9dcd', 'steam:1100001471c8302', 'steam:1100001493e69fd']
                is_master = session['steam_hex'] in master_hexes
                role = self._get_session_role(session)
                self.wfile.write(json.dumps({
                    "authenticated": True,
                    "user": {
                        "steamHex": session['steam_hex'],
                        "nome": session['nome'],
                        "avatarUrl": session['avatar_url'],
                        "expiresAt": session['expires_at'],
                        "isMaster": is_master,
                        "role": role
                    }
                }).encode('utf-8'))
            else:
                self.wfile.write(json.dumps({"authenticated": False}).encode('utf-8'))
            return

        if path.endswith('/members/sync-avatars'):
            updated = sync_missing_steam_avatars()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({"ok": True, "updated": updated}).encode('utf-8'))
            return

        if path.endswith('/members'):
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT 
                        f.steam_hex, 
                        f.nome, 
                        f.avatar_url, 
                        f.ativo, 
                        COALESCE(r.cargo, 'auxiliar'), 
                        f.last_synced_at,
                        COALESCE(
                            r.discord_id,
                            (SELECT mecanico_discord FROM work_hours WHERE LOWER(mecanico_steam_hex) = LOWER(f.steam_hex) AND mecanico_discord != '' ORDER BY entrada_timestamp DESC LIMIT 1),
                            (SELECT funcionario_discord FROM faturas WHERE LOWER(funcionario_steam_hex) = LOWER(f.steam_hex) AND funcionario_discord != '' ORDER BY timestamp DESC LIMIT 1),
                            ''
                        ) as discord_tag
                    FROM funcionarios f
                    LEFT JOIN member_roles r ON LOWER(f.steam_hex) = LOWER(r.steam_hex)
                    WHERE f.ativo = 1 AND LOWER(f.steam_hex) NOT IN ('steam:11000010c35c4c6', '11000010c35c4c6')
                    ORDER BY f.nome ASC
                ''')
                rows = cursor.fetchall()
                members = []
                for r in rows:
                    raw_disc = r[6] or ''
                    d_id = ''
                    if raw_disc:
                        m_d = re.search(r'\d{17,20}', str(raw_disc))
                        if m_d:
                            d_id = m_d.group(0)

                    members.append({
                        "steamHex": r[0],
                        "nome": r[1],
                        "avatarUrl": r[2] or '',
                        "ativo": bool(r[3]),
                        "cargo": r[4],
                        "lastSyncedAt": r[5],
                        "discordTag": f"<@{d_id}>" if d_id else raw_disc,
                        "discordId": d_id
                    })
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Cache-Control', 'no-cache, no-store')
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({"members": members}).encode('utf-8'))
            return

        if path.endswith('/work-hours/cycles'):
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('SELECT steam_hex, cargo FROM member_roles')
                member_roles_map = {row[0].lower(): row[1] for row in cursor.fetchall() if row[0] and row[1]}

                cursor.execute('''
                    SELECT id, label, start_timestamp, end_timestamp, archived_at, archived_by_hex, archived_by_nome, total_hours_minutos, total_membros, ranking_json
                    FROM work_hours_cycles
                    ORDER BY archived_at DESC
                ''')
                rows = cursor.fetchall()
                cycles = []
                for r in rows:
                    ranking_data = []
                    try:
                        if r[9]:
                            ranking_data = json.loads(r[9])
                    except Exception:
                        pass

                    role_labels = {
                        "dono": "Dono", "gerente": "Gerente", "supervisor": "Supervisor",
                        "profissional": "Profissional", "auxiliar": "Auxiliar", "aprendiz": "Aprendiz"
                    }
                    for item in ranking_data:
                        tot_min = item.get("totalMinutos", 0)
                        if "totalFormatado" not in item or not item["totalFormatado"]:
                            item["totalFormatado"] = f"{tot_min // 60}h {tot_min % 60:02d}min"
                        hex_id = (item.get("steamHex") or "").lower()
                        cargo = (member_roles_map.get(hex_id) or item.get("cargo") or "auxiliar").lower()
                        item["cargo"] = cargo
                        item["cargoLabel"] = role_labels.get(cargo, cargo.capitalize())

                    cycles.append({
                        "id": r[0],
                        "label": r[1],
                        "startTimestamp": r[2],
                        "endTimestamp": r[3],
                        "archivedAt": r[4],
                        "archivedByHex": r[5] or '',
                        "archivedByNome": r[6] or '',
                        "totalHoursMinutos": r[7] or 0,
                        "totalMembros": r[8] or 0,
                        "ranking": ranking_data
                    })
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Cache-Control', 'no-cache, no-store')
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({"cycles": cycles}).encode('utf-8'))
            return

        if path.endswith('/work-hours'):
            cycle_id = query_params.get('cycle_id', [''])[0].strip()
            active_cycle_start_ms = 0
            with get_db_connection() as conn:
                cursor = conn.cursor()
                if cycle_id:
                    cursor.execute('''
                        SELECT id, mecanico_steam_hex, mecanico_nome, '' as mecanico_discord, cargo, entrada_timestamp, saida_timestamp, duracao_minutos, status, turno, data_str, horario_entrada_str, horario_saida_str, 0 as criado_manualmente, observacao
                        FROM work_hours_archive
                        WHERE cycle_id = ? AND LOWER(mecanico_steam_hex) NOT IN ('steam:11000010c35c4c6', '11000010c35c4c6')
                        ORDER BY entrada_timestamp DESC
                    ''', (cycle_id,))
                else:
                    cursor.execute("SELECT value FROM system_settings WHERE key = 'work_hours_cycle_start_ms'")
                    row_setting = cursor.fetchone()
                    if row_setting and row_setting[0]:
                        try:
                            active_cycle_start_ms = int(row_setting[0])
                        except ValueError:
                            active_cycle_start_ms = 0

                    cursor.execute('''
                        SELECT id, mecanico_steam_hex, mecanico_nome, mecanico_discord, cargo, entrada_timestamp, saida_timestamp, duracao_minutos, status, turno, data_str, horario_entrada_str, horario_saida_str, criado_manualmente, observacao
                        FROM work_hours
                        WHERE LOWER(mecanico_steam_hex) NOT IN ('steam:11000010c35c4c6', '11000010c35c4c6')
                        ORDER BY entrada_timestamp DESC
                    ''')
                rows = cursor.fetchall()
                entries = []
                for r in rows:
                    dur = r[7] or 0
                    ent_ts = r[5] or 0
                    sai_ts = r[6] or 0
                    effective_dur = dur
                    is_pre_cycle = False

                    if not cycle_id and active_cycle_start_ms > 0:
                        if sai_ts and sai_ts <= active_cycle_start_ms:
                            effective_dur = 0
                            is_pre_cycle = True
                        elif ent_ts < active_cycle_start_ms:
                            if sai_ts > active_cycle_start_ms:
                                effective_dur = max(0, round((sai_ts - active_cycle_start_ms) / 60000))
                                is_pre_cycle = False
                            elif r[8] == 'aberto':
                                is_pre_cycle = False
                        else:
                            effective_dur = dur
                            is_pre_cycle = False

                    entries.append({
                        "id": r[0],
                        "mecanicoSteamHex": r[1],
                        "mecanicoNome": r[2],
                        "mecanicoDiscord": r[3] or '',
                        "cargo": r[4],
                        "entradaTimestamp": r[5],
                        "saidaTimestamp": r[6],
                        "duracaoMinutos": dur,
                        "effectiveDuracaoMinutos": effective_dur,
                        "isPreCycle": is_pre_cycle,
                        "status": r[8],
                        "turno": r[9],
                        "dataStr": r[10],
                        "horarioEntradaStr": r[11],
                        "horarioSaidaStr": r[12],
                        "criadoManualmente": bool(r[13]),
                        "observacao": r[14] or ''
                    })
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Cache-Control', 'no-cache, no-store')
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({
                "entries": entries,
                "cycleId": cycle_id,
                "activeCycleStartMs": active_cycle_start_ms
            }).encode('utf-8'))
            return

        if path.endswith('/inventory/items'):
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('SELECT id, nome, categoria, quantidade_atual, meta_minima, unidade, icone, descricao, ultima_atualizacao, atualizado_por FROM inventory ORDER BY nome ASC')
                rows = cursor.fetchall()
                items = []
                for r in rows:
                    items.append({
                        "id": r[0],
                        "nome": r[1],
                        "categoria": r[2],
                        "quantidadeAtual": r[3],
                        "metaMinima": r[4],
                        "unidade": r[5] or 'un',
                        "icone": r[6],
                        "descricao": r[7],
                        "ultimaAtualizacao": r[8],
                        "atualizadoPor": r[9]
                    })
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Cache-Control', 'no-cache, no-store')
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({"items": items}).encode('utf-8'))
            return

        if path.endswith('/inventory/transactions'):
            session = self._get_auth_session()
            secret_provided = (
                self.headers.get('X-Admin-Secret', '')
                or self.headers.get('Authorization', '').replace('Bearer ', '')
            )
            if not self._is_manager_or_dono(session, secret_provided):
                self.send_response(403)
                self.send_header('Content-Type', 'application/json')
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Acesso negado. Apenas Gerentes e Donos podem visualizar transações do Baú."}).encode('utf-8'))
                return

            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('SELECT id, item_id, item_nome, tipo, quantidade, mecanico_nome, mecanico_discord, mecanico_steam_hex, data_hora_str, timestamp, observacao FROM inventory_transactions ORDER BY timestamp DESC LIMIT 50')
                rows = cursor.fetchall()
                txs = []
                for r in rows:
                    txs.append({
                        "id": r[0],
                        "itemId": r[1],
                        "itemNome": r[2],
                        "tipo": r[3],
                        "quantidade": r[4],
                        "mecanicoNome": r[5],
                        "mecanicoDiscord": r[6],
                        "mecanicoSteamHex": r[7],
                        "dataHoraStr": r[8],
                        "timestamp": r[9],
                        "observacao": r[10]
                    })
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Cache-Control', 'no-cache, no-store')
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({"transactions": txs}).encode('utf-8'))
            return

        if path.endswith('/faturas/ranking'):
            period = query_params.get('period', ['geral'])[0].lower()
            sort_by = query_params.get('sortBy', ['guincho'])[0].lower()
            ignore_leadership = query_params.get('ignoreLeadership', ['0'])[0] in ('1', 'true', 'yes')

            time_start, time_end = get_period_time_range(period)

            if sort_by in ('geral', 'dinheiro_geral'):
                order_clause = "faturamento_total DESC, total_guinchos DESC"
            elif sort_by in ('dinheiro_guincho', 'guincho_dinheiro'):
                order_clause = "faturamento_guincho DESC, total_guinchos DESC"
            else:
                order_clause = "total_guinchos DESC, faturamento_guincho DESC"

            where_conditions = ["f.tipo_registro = 'registro'"]
            params = []

            if time_start > 0 and time_end > 0:
                where_conditions.append("f.timestamp >= ? AND f.timestamp <= ?")
                params.extend([time_start, time_end])
            elif time_start > 0:
                where_conditions.append("f.timestamp >= ?")
                params.append(time_start)

            if ignore_leadership:
                where_conditions.append("LOWER(COALESCE(mr.cargo, 'profissional')) NOT IN ('dono', 'gerente', 'diretor', 'subgerente')")
                where_conditions.append("LOWER(f.funcionario_steam_hex) NOT IN ('steam:11000015ecf682c', 'steam:110000106803154')")

            where_sql = " AND ".join(where_conditions)

            with get_db_connection() as conn:
                cursor = conn.cursor()
                query_sql = f'''
                    SELECT 
                        f.funcionario_steam_hex,
                        f.funcionario_nome,
                        COALESCE(func.avatar_url, '') as avatar_url,
                        COALESCE(mr.cargo, 'profissional') as cargo,
                        SUM(f.guincho_cidade_qtd) as guincho_cidade,
                        SUM(f.guincho_fora_qtd) as guincho_fora,
                        SUM(f.guincho_cidade_qtd + f.guincho_fora_qtd) as total_guinchos,
                        COUNT(f.id) as total_faturas,
                        SUM(f.valor_guincho) as faturamento_guincho,
                        SUM(f.valor_total) as faturamento_total
                    FROM faturas f
                    LEFT JOIN funcionarios func ON LOWER(func.steam_hex) = LOWER(f.funcionario_steam_hex)
                    LEFT JOIN member_roles mr ON LOWER(mr.steam_hex) = LOWER(f.funcionario_steam_hex)
                    WHERE {where_sql}
                    GROUP BY f.funcionario_steam_hex, f.funcionario_nome
                    ORDER BY {order_clause}
                '''
                cursor.execute(query_sql, tuple(params))

                rows = cursor.fetchall()
                ranking = []
                for r in rows:
                    ranking.append({
                        "funcionarioSteamHex": r[0] or '',
                        "funcionarioNome": r[1],
                        "avatarUrl": r[2],
                        "cargo": r[3],
                        "guinchoCidade": r[4] or 0,
                        "guinchoFora": r[5] or 0,
                        "totalGuinchos": r[6] or 0,
                        "totalFaturas": r[7] or 0,
                        "faturamentoGuincho": r[8] or 0,
                        "faturamentoTotal": r[9] or 0
                    })

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Cache-Control', 'no-cache, no-store')
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({"period": period, "sortBy": sort_by, "ranking": ranking}).encode('utf-8'))
            return

        if path.endswith('/faturas/items-ranking'):
            period = query_params.get('period', ['geral'])[0].lower()
            category_filter = query_params.get('categoria', [''])[0].strip().lower()
            time_start, time_end = get_period_time_range(period)

            where_sql = "tipo_registro = 'registro'"
            params = []
            if time_start > 0 and time_end > 0:
                where_sql += " AND timestamp >= ? AND timestamp <= ?"
                params.extend([time_start, time_end])
            elif time_start > 0:
                where_sql += " AND timestamp >= ?"
                params.append(time_start)

            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(f"SELECT servicos_json FROM faturas WHERE {where_sql}", tuple(params))
                rows = cursor.fetchall()

            items_map = {}
            for (s_json,) in rows:
                try:
                    s_list = json.loads(s_json)
                    for item in s_list:
                        name = item.get('nome', '').strip()
                        val = item.get('valor', 0)
                        if not name:
                            continue

                        norm_name = name.replace(' fitro', ' filtro')
                        if norm_name not in items_map:
                            lower_n = norm_name.lower()
                            if 'guinchar' in lower_n or 'guincho' in lower_n:
                                cat = 'Guincho'
                            elif 'radiador' in lower_n:
                                cat = 'Radiador / Arrefecimento'
                            elif any(k in lower_n for k in ['óleo', 'oleo', 'água', 'agua', 'filtro', 'aditivo']):
                                cat = 'Revisão Básica'
                            elif any(k in lower_n for k in ['bloco', 'pistão', 'pistao', 'biela', 'cabeçote', 'cabecote', 'retífica', 'retifica', 'motor', 'junta', 'anel', 'bronzina']):
                                cat = 'Motor & Retífica'
                            elif any(k in lower_n for k in ['freio', 'pastilha', 'disco', 'pinça', 'pinca']):
                                cat = 'Freios'
                            elif any(k in lower_n for k in ['pneu', 'slick', 'offroad', 'roda']):
                                cat = 'Pneus & Rodas'
                            elif any(k in lower_n for k in ['turbo', 'intercooler', 'escape', 'escapamento', 'suspensao', 'suspensão', 'direção', 'direcao']):
                                cat = 'Performance'
                            elif any(k in lower_n for k in ['lataria', 'pintura', 'parachoque']):
                                cat = 'Estética & Lataria'
                            else:
                                cat = 'Outros Serviços'

                            items_map[norm_name] = {
                                "nome": norm_name,
                                "categoria": cat,
                                "quantidade": 0,
                                "faturamentoTotal": 0
                            }
                        items_map[norm_name]["quantidade"] += 1
                        items_map[norm_name]["faturamentoTotal"] += val
                except Exception:
                    continue

            all_items = list(items_map.values())
            if category_filter and category_filter != 'todos':
                all_items = [it for it in all_items if it['categoria'].lower() == category_filter]

            sorted_items = sorted(all_items, key=lambda x: (x['quantidade'], x['faturamentoTotal']), reverse=True)
            total_qtd = sum(x['quantidade'] for x in sorted_items)
            total_fat = sum(x['faturamentoTotal'] for x in sorted_items)

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Cache-Control', 'no-cache, no-store')
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({
                "period": period,
                "totalTipos": len(sorted_items),
                "totalQtd": total_qtd,
                "totalFaturamento": total_fat,
                "items": sorted_items
            }).encode('utf-8'))
            return

        if path.endswith('/faturas/logs'):
            limit = min(200, max(1, int(query_params.get('limit', ['100'])[0])))
            offset = max(0, int(query_params.get('offset', ['0'])[0]))
            only_guincho = query_params.get('onlyGuincho', ['0'])[0] == '1'
            search = query_params.get('search', [''])[0].strip().lower()

            with get_db_connection() as conn:
                cursor = conn.cursor()
                query = '''
                    SELECT 
                        f.id, f.funcionario_nome, f.funcionario_steam_hex, f.funcionario_discord,
                        f.cliente_nome, f.cliente_steam_hex, f.cliente_discord,
                        f.servicos_json, f.valor_total, f.tipo_registro,
                        f.guincho_cidade_qtd, f.guincho_fora_qtd,
                        f.timestamp, f.data_str, f.horario_str,
                        COALESCE(func.avatar_url, '') as avatar_url,
                        f.valor_guincho
                    FROM faturas f
                    LEFT JOIN funcionarios func ON LOWER(func.steam_hex) = LOWER(f.funcionario_steam_hex)
                    WHERE 1=1
                '''
                params = []
                if only_guincho:
                    query += ' AND (f.guincho_cidade_qtd > 0 OR f.guincho_fora_qtd > 0)'
                if search:
                    query += ' AND (LOWER(f.funcionario_nome) LIKE ? OR LOWER(f.cliente_nome) LIKE ? OR LOWER(f.servicos_json) LIKE ?)'
                    params.extend([f"%{search}%", f"%{search}%", f"%{search}%"])
                
                query += ' ORDER BY f.timestamp DESC LIMIT ? OFFSET ?'
                params.extend([limit, offset])

                cursor.execute(query, tuple(params))
                rows = cursor.fetchall()
                logs = []
                for r in rows:
                    try:
                        servicos_parsed = json.loads(r[7])
                    except Exception:
                        servicos_parsed = []

                    logs.append({
                        "id": r[0],
                        "funcionarioNome": r[1],
                        "funcionarioSteamHex": r[2] or '',
                        "funcionarioDiscord": r[3] or '',
                        "clienteNome": r[4] or '',
                        "clienteSteamHex": r[5] or '',
                        "clienteDiscord": r[6] or '',
                        "servicos": servicos_parsed,
                        "valorTotal": r[8],
                        "tipoRegistro": r[9],
                        "guinchoCidadeQtd": r[10] or 0,
                        "guinchoForaQtd": r[11] or 0,
                        "timestamp": r[12],
                        "dataStr": r[13],
                        "horarioStr": r[14],
                        "avatarUrl": r[15],
                        "valorGuincho": r[16] if len(r) > 16 else 0
                    })

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Cache-Control', 'no-cache, no-store')
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({"logs": logs}).encode('utf-8'))
            return

        if path.endswith('/faturas/summary'):
            now_dt = datetime.datetime.now(BRT_TZ)
            days_since_monday = now_dt.weekday() # 0 = Segunda, 6 = Domingo
            start_current_week_dt = (now_dt - datetime.timedelta(days=days_since_monday)).replace(hour=0, minute=0, second=0, microsecond=0)
            start_last_week_dt = start_current_week_dt - datetime.timedelta(days=7)
            end_last_week_dt = start_current_week_dt - datetime.timedelta(milliseconds=1)

            start_today = int(now_dt.replace(hour=0, minute=0, second=0, microsecond=0).timestamp() * 1000)
            start_week = int(start_current_week_dt.timestamp() * 1000)
            start_last_week = int(start_last_week_dt.timestamp() * 1000)
            end_last_week = int(end_last_week_dt.timestamp() * 1000)
            start_month = int(now_dt.replace(day=1, hour=0, minute=0, second=0, microsecond=0).timestamp() * 1000)

            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT 
                        COALESCE(SUM(CASE WHEN timestamp >= ? THEN (guincho_cidade_qtd + guincho_fora_qtd) ELSE 0 END), 0) as guinchos_hoje,
                        COALESCE(SUM(CASE WHEN timestamp >= ? THEN (guincho_cidade_qtd + guincho_fora_qtd) ELSE 0 END), 0) as guinchos_semana,
                        COALESCE(SUM(CASE WHEN timestamp >= ? AND timestamp <= ? THEN (guincho_cidade_qtd + guincho_fora_qtd) ELSE 0 END), 0) as guinchos_semana_ant,
                        COALESCE(SUM(CASE WHEN timestamp >= ? THEN (guincho_cidade_qtd + guincho_fora_qtd) ELSE 0 END), 0) as guinchos_mes,
                        COALESCE(SUM(guincho_cidade_qtd + guincho_fora_qtd), 0) as guinchos_geral,
                        COALESCE(SUM(CASE WHEN timestamp >= ? THEN guincho_cidade_qtd ELSE 0 END), 0) as guincho_cidade_hoje,
                        COALESCE(SUM(CASE WHEN timestamp >= ? THEN guincho_fora_qtd ELSE 0 END), 0) as guincho_fora_hoje,
                        COALESCE(SUM(CASE WHEN timestamp >= ? THEN valor_guincho ELSE 0 END), 0) as faturamento_guincho_hoje,
                        COALESCE(SUM(CASE WHEN timestamp >= ? THEN valor_guincho ELSE 0 END), 0) as faturamento_guincho_semana,
                        COALESCE(SUM(CASE WHEN timestamp >= ? AND timestamp <= ? THEN valor_guincho ELSE 0 END), 0) as faturamento_guincho_semana_ant,
                        COALESCE(SUM(CASE WHEN timestamp >= ? THEN valor_guincho ELSE 0 END), 0) as faturamento_guincho_mes,
                        COALESCE(SUM(valor_guincho), 0) as faturamento_guincho_geral,
                        COALESCE(SUM(CASE WHEN timestamp >= ? THEN valor_total ELSE 0 END), 0) as faturamento_total_hoje,
                        COALESCE(SUM(CASE WHEN timestamp >= ? THEN valor_total ELSE 0 END), 0) as faturamento_total_semana,
                        COALESCE(SUM(CASE WHEN timestamp >= ? AND timestamp <= ? THEN valor_total ELSE 0 END), 0) as faturamento_total_semana_ant,
                        COALESCE(SUM(CASE WHEN timestamp >= ? THEN valor_total ELSE 0 END), 0) as faturamento_total_mes,
                        COUNT(CASE WHEN timestamp >= ? THEN id ELSE NULL END) as total_faturas_hoje,
                        COUNT(CASE WHEN timestamp >= ? THEN id ELSE NULL END) as total_faturas_semana,
                        COUNT(CASE WHEN timestamp >= ? AND timestamp <= ? THEN id ELSE NULL END) as total_faturas_semana_ant,
                        COUNT(id) as total_faturas_geral
                    FROM faturas
                    WHERE tipo_registro = 'registro'
                ''', (
                    start_today, start_week, start_last_week, end_last_week, start_month,
                    start_today, start_today,
                    start_today, start_week, start_last_week, end_last_week, start_month,
                    start_today, start_week, start_last_week, end_last_week, start_month,
                    start_today, start_week, start_last_week, end_last_week
                ))
                r = cursor.fetchone()
                summary = {
                    "guinchosHoje": r[0],
                    "guinchosSemana": r[1],
                    "guinchosSemanaAnterior": r[2],
                    "guinchosMes": r[3],
                    "guinchosGeral": r[4],
                    "guinchoCidadeHoje": r[5],
                    "guinchoForaHoje": r[6],
                    "faturamentoGuinchoHoje": r[7],
                    "faturamentoGuinchoSemana": r[8],
                    "faturamentoGuinchoSemanaAnterior": r[9],
                    "faturamentoGuinchoMes": r[10],
                    "faturamentoGuinchoGeral": r[11],
                    "faturamentoHoje": r[12],
                    "faturamentoSemana": r[13],
                    "faturamentoSemanaAnterior": r[14],
                    "faturamentoMes": r[15],
                    "totalFaturasHoje": r[16],
                    "totalFaturasSemana": r[17],
                    "totalFaturasSemanaAnterior": r[18],
                    "totalFaturasGeral": r[19]
                }

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Cache-Control', 'no-cache, no-store')
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({"summary": summary}).encode('utf-8'))
            return

        if path.endswith('/admin') or query_params.get('admin', ['0'])[0] == '1':
            is_allowed, wait_sec = check_ip_rate_limit(client_ip)
            if not is_allowed:
                self.send_response(429)
                self.send_header('Content-Type', 'application/json')
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({
                    "error": f"Muitas tentativas incorretas. IP bloqueado temporariamente por {wait_sec // 60 + 1} minutos."
                }).encode('utf-8'))
                return

            secret_provided = (
                query_params.get('secret', [''])[0]
                or self.headers.get('X-Admin-Secret', '')
                or self.headers.get('Authorization', '').replace('Bearer ', '')
            )
            if not ADMIN_SECRET or secret_provided != ADMIN_SECRET:
                record_failed_attempt(client_ip)
                self.send_response(401)
                self.send_header('Content-Type', 'application/json')
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Acesso nao autorizado ao painel administrativo"}).encode('utf-8'))
                return

            clear_failed_attempts(client_ip)
            self._handle_admin_metrics()
            return

        if path.endswith('/telemetry/proxy-image') or path.endswith('/proxy-image'):
            qs = parse_qs(parsed.query)
            target_url = qs.get('url', [''])[0].strip()
            safe, reason = is_safe_proxy_url(target_url)
            if not safe:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"error": f"URL bloqueada por segurança: {reason}"}).encode('utf-8'))
                return

            try:
                req = urllib.request.Request(target_url, headers={
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                })
                with urllib.request.urlopen(req, timeout=10) as resp:
                    content_type = resp.headers.get('Content-Type', '').lower()
                    if not (content_type.startswith('image/') or 'octet-stream' in content_type):
                        self.send_response(400)
                        self.send_header('Content-Type', 'application/json')
                        self._send_cors_headers()
                        self.end_headers()
                        self.wfile.write(json.dumps({"error": "O recurso de destino não é uma imagem válida."}).encode('utf-8'))
                        return

                    MAX_IMG_SIZE = 10 * 1024 * 1024  # 10 MB
                    chunks = []
                    total_bytes = 0
                    while True:
                        chunk = resp.read(64 * 1024)
                        if not chunk:
                            break
                        total_bytes += len(chunk)
                        if total_bytes > MAX_IMG_SIZE:
                            self.send_response(413)
                            self.send_header('Content-Type', 'application/json')
                            self._send_cors_headers()
                            self.end_headers()
                            self.wfile.write(json.dumps({"error": "A imagem excede o tamanho máximo de 10MB."}).encode('utf-8'))
                            return
                        chunks.append(chunk)

                    data = b''.join(chunks)
                    self.send_response(200)
                    self.send_header('Content-Type', content_type or 'image/png')
                    self.send_header('Cache-Control', 'public, max-age=86400')
                    self._send_cors_headers()
                    self.end_headers()
                    self.wfile.write(data)
                    return
            except Exception as e:
                self.send_response(502)
                self.send_header('Content-Type', 'application/json')
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"error": f"Falha ao carregar imagem: {str(e)}"}).encode('utf-8'))
                return

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

            cursor.execute('SELECT COUNT(*) FROM extractions WHERE timestamp >= ?', (week_ago_ms,))
            week_row = cursor.fetchone()

            cursor.execute('''
                SELECT COALESCE(service_mode, 'oleo'), COUNT(*)
                FROM extractions
                WHERE timestamp >= ?
                GROUP BY service_mode
            ''', (start_ms,))
            services_today = dict(cursor.fetchall())

            cursor.execute('''
                SELECT model, COUNT(*)
                FROM extractions
                WHERE timestamp >= ?
                GROUP BY model
            ''', (start_ms,))
            models_today = dict(cursor.fetchall())

            cursor.execute('''
                SELECT timestamp
                FROM extractions
                WHERE timestamp >= ?
            ''', (start_ms,))
            timestamps_today = [r[0] for r in cursor.fetchall()]

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
                WHERE e.mechanic_steam_hex IS NOT NULL AND e.mechanic_steam_hex != '' AND LOWER(e.mechanic_steam_hex) NOT IN ('steam:11000010c35c4c6', '11000010c35c4c6')
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

            cursor.execute('''
                SELECT f.steam_hex, f.nome, f.avatar_url, f.ativo, COALESCE(r.cargo, 'auxiliar'), f.last_synced_at
                FROM funcionarios f
                LEFT JOIN member_roles r ON LOWER(f.steam_hex) = LOWER(r.steam_hex)
                WHERE f.ativo = 1 AND LOWER(f.steam_hex) NOT IN ('steam:11000010c35c4c6', '11000010c35c4c6')
                ORDER BY f.nome ASC
            ''')
            func_rows = cursor.fetchall()
            funcionarios_list = []
            for fr in func_rows:
                funcionarios_list.append({
                    "steamHex": fr[0],
                    "nome": fr[1],
                    "avatarUrl": fr[2] or '',
                    "ativo": bool(fr[3]),
                    "cargo": fr[4],
                    "lastSyncedAt": fr[5]
                })

            cursor.execute('''
                SELECT id, timestamp, success, duration_ms, model, placa, modelo, servico, service_mode, mechanic_name, mechanic_steam_hex, gpu_model, hardware_info
                FROM extractions
                ORDER BY id DESC
                LIMIT 100
            ''')
            log_rows = cursor.fetchall()

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
                "mechanicSteamHex": r[10] or '',
                "gpuModel": r[11] or '',
                "hardwareInfo": r[12] or ''
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
        client_ip = self._get_client_ip()

        try:
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length > 25 * 1024 * 1024:
                self.send_response(413)
                self.send_header('Content-Type', 'application/json')
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Payload excessivamente grande"}).encode('utf-8'))
                return

            body = self.rfile.read(content_length) if content_length > 0 else b'{}'
            data = json.loads(body.decode('utf-8')) if body else {}

            if path.endswith('/auth/verify-secret'):
                is_allowed, wait_sec = check_ip_rate_limit(client_ip)
                if not is_allowed:
                    self.send_response(429)
                    self.send_header('Content-Type', 'application/json')
                    self._send_cors_headers()
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        "error": f"Muitas tentativas incorretas. IP bloqueado temporariamente por {wait_sec // 60 + 1} minutos."
                    }).encode('utf-8'))
                    return

                secret_provided = str(data.get('secret', '')).strip()
                if not ADMIN_SECRET or secret_provided != ADMIN_SECRET:
                    record_failed_attempt(client_ip)
                    self.send_response(401)
                    self.send_header('Content-Type', 'application/json')
                    self._send_cors_headers()
                    self.end_headers()
                    self.wfile.write(json.dumps({"ok": False, "error": "Senha administrativa incorreta."}).encode('utf-8'))
                    return

                clear_failed_attempts(client_ip)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({
                    "ok": True
                }).encode('utf-8'))
                return

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

            if path.endswith('/discord/upload'):
                session = self._get_auth_session()
                secret_provided = (
                    self.headers.get('X-Admin-Secret', '')
                    or self.headers.get('Authorization', '').replace('Bearer ', '')
                )
                origin = self.headers.get('Origin', '')
                allowed_from_app = is_origin_allowed(origin)

                if not session and secret_provided != ADMIN_SECRET and not allowed_from_app:
                    self.send_response(401)
                    self.send_header('Content-Type', 'application/json')
                    self._send_cors_headers()
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": "Autenticação necessária para envio de mensagens."}).encode('utf-8'))
                    return

                if not check_webhook_rate_limit(client_ip):
                    self.send_response(429)
                    self.send_header('Content-Type', 'application/json')
                    self._send_cors_headers()
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": "Limite de envios excedido. Aguarde 1 minuto."}).encode('utf-8'))
                    return

                content = str(data.get('content', ''))[:2000]
                image_data = data.get('image')
                filename = str(data.get('filename', 'veiculo.webp'))[:64]
                
                image_bytes = None
                if image_data and isinstance(image_data, str):
                    if ',' in image_data:
                        image_data = image_data.split(',', 1)[1]
                    try:
                        image_bytes = base64.b64decode(image_data)
                    except Exception:
                        image_bytes = None

                ok, result = forward_to_discord_webhook(content, image_bytes, filename)
                self.send_response(200 if ok else 502)
                self.send_header('Content-Type', 'application/json')
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps(result).encode('utf-8'))
                return

            if path.endswith('/discord/update'):
                session = self._get_auth_session()
                secret_provided = (
                    self.headers.get('X-Admin-Secret', '')
                    or self.headers.get('Authorization', '').replace('Bearer ', '')
                )
                origin = self.headers.get('Origin', '')
                allowed_from_app = is_origin_allowed(origin)

                if not session and secret_provided != ADMIN_SECRET and not allowed_from_app:
                    self.send_response(401)
                    self.send_header('Content-Type', 'application/json')
                    self._send_cors_headers()
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": "Autenticação necessária para edição de mensagens."}).encode('utf-8'))
                    return

                if not check_webhook_rate_limit(client_ip):
                    self.send_response(429)
                    self.send_header('Content-Type', 'application/json')
                    self._send_cors_headers()
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": "Limite de envios excedido. Aguarde 1 minuto."}).encode('utf-8'))
                    return

                message_id = str(data.get('messageId', ''))[:64]
                content = str(data.get('content', ''))[:2000]
                ok, result = update_discord_webhook_message(message_id, content)
                self.send_response(200 if ok else 502)
                self.send_header('Content-Type', 'application/json')
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps(result).encode('utf-8'))
                return

            if path.endswith('/discord/alert'):
                session = self._get_auth_session()
                secret_provided = (
                    self.headers.get('X-Admin-Secret', '')
                    or self.headers.get('Authorization', '').replace('Bearer ', '')
                )
                origin = self.headers.get('Origin', '')
                allowed_from_app = is_origin_allowed(origin)

                if not session and secret_provided != ADMIN_SECRET and not allowed_from_app:
                    self.send_response(401)
                    self.send_header('Content-Type', 'application/json')
                    self._send_cors_headers()
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": "Autenticação necessária para disparo de alertas."}).encode('utf-8'))
                    return

                if not check_webhook_rate_limit(client_ip):
                    self.send_response(429)
                    self.send_header('Content-Type', 'application/json')
                    self._send_cors_headers()
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": "Limite de envios excedido. Aguarde 1 minuto."}).encode('utf-8'))
                    return

                content = str(data.get('content', ''))[:2000]
                ok, result = forward_to_discord_webhook(content)
                self.send_response(200 if ok else 502)
                self.send_header('Content-Type', 'application/json')
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps(result).encode('utf-8'))
                return

            if path.endswith('/admin/sync-funcionarios'):
                is_allowed, wait_sec = check_ip_rate_limit(client_ip)
                if not is_allowed:
                    self.send_response(429)
                    self.send_header('Content-Type', 'application/json')
                    self._send_cors_headers()
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        "error": f"Muitas tentativas incorretas. IP bloqueado temporariamente por {wait_sec // 60 + 1} minutos."
                    }).encode('utf-8'))
                    return

                secret_provided = (
                    data.get('secret', '')
                    or self.headers.get('X-Admin-Secret', '')
                    or self.headers.get('Authorization', '').replace('Bearer ', '')
                )
                if not ADMIN_SECRET or secret_provided != ADMIN_SECRET:
                    record_failed_attempt(client_ip)
                    self.send_response(401)
                    self.send_header('Content-Type', 'application/json')
                    self._send_cors_headers()
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": "Acesso nao autorizado"}).encode('utf-8'))
                    return

                clear_failed_attempts(client_ip)
                ok, count = sync_funcionarios_from_api()
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"success": ok, "total": count}).encode('utf-8'))
                return

            if path.endswith('/update'):
                servico = str(data.get('servico', ''))[:256]
                service_mode = str(data.get('serviceMode', ''))[:32]
                ext_id = data.get('id')
                placa = str(data.get('placa', ''))[:32] if data.get('placa') else None

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

            if path.endswith('/inventory/items'):
                session = self._get_auth_session()
                secret_provided = (
                    data.get('secret', '')
                    or self.headers.get('X-Admin-Secret', '')
                    or self.headers.get('Authorization', '').replace('Bearer ', '')
                )
                if not self._is_manager_or_dono(session, secret_provided):
                    self.send_response(403)
                    self.send_header('Content-Type', 'application/json')
                    self._send_cors_headers()
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": "Acesso negado. Apenas Gerentes e Donos podem modificar o Baú."}).encode('utf-8'))
                    return

                item_id = str(data.get('id') or f"item-{int(time.time()*1000)}")
                nome = str(data.get('nome', ''))[:128]
                categoria = str(data.get('categoria', 'performance'))[:64]
                quantidade_atual = max(0, int(data.get('quantidadeAtual', 0)))
                meta_minima = max(0, int(data.get('metaMinima', 10)))
                unidade = str(data.get('unidade', 'un'))[:16]
                descricao = str(data.get('descricao', ''))[:500]
                now_ms = int(time.time() * 1000)
                atualizado_por = session['nome'] if session else 'Gerencia'

                with get_db_connection() as conn:
                    cursor = conn.cursor()
                    cursor.execute('''
                        INSERT INTO inventory (id, nome, categoria, quantidade_atual, meta_minima, unidade, descricao, ultima_atualizacao, atualizado_por)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ON CONFLICT(id) DO UPDATE SET
                            nome = excluded.nome,
                            categoria = excluded.categoria,
                            quantidade_atual = excluded.quantidade_atual,
                            meta_minima = excluded.meta_minima,
                            unidade = excluded.unidade,
                            descricao = excluded.descricao,
                            ultima_atualizacao = excluded.ultima_atualizacao,
                            atualizado_por = excluded.atualizado_por
                    ''', (item_id, nome, categoria, quantidade_atual, meta_minima, unidade, descricao, now_ms, atualizado_por))

                    if session:
                        cursor.execute('''
                            INSERT INTO audit_logs (admin_steam_hex, admin_nome, action_type, target_id, description, timestamp, ip_address)
                            VALUES (?, ?, 'INVENTORY_SAVE', ?, ?, ?, ?)
                        ''', (session['steam_hex'], session['nome'], item_id, f"Item {nome} ({quantidade_atual} {unidade})", now_ms, client_ip))
                    conn.commit()

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"ok": True, "id": item_id}).encode('utf-8'))
                return

            if path.endswith('/inventory/items/batch'):
                session = self._get_auth_session()
                secret_provided = (
                    data.get('secret', '')
                    or self.headers.get('X-Admin-Secret', '')
                    or self.headers.get('Authorization', '').replace('Bearer ', '')
                )
                if not self._is_manager_or_dono(session, secret_provided):
                    self.send_response(403)
                    self.send_header('Content-Type', 'application/json')
                    self._send_cors_headers()
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": "Acesso negado."}).encode('utf-8'))
                    return

                items = data.get('items', [])
                now_ms = int(time.time() * 1000)
                atualizado_por = session['nome'] if session else 'Gerência'

                with get_db_connection() as conn:
                    cursor = conn.cursor()
                    for item in items:
                        item_id = str(item.get('id') or f"item-{int(time.time()*1000)}-{secrets.token_hex(3)}")
                        nome = str(item.get('nome', ''))[:128]
                        categoria = str(item.get('categoria', 'performance'))[:64]
                        quantidade_atual = max(0, int(item.get('quantidadeAtual', 0)))
                        meta_minima = max(0, int(item.get('metaMinima', 10)))
                        unidade = str(item.get('unidade', 'un'))[:16]
                        descricao = str(item.get('descricao', ''))[:500]

                        cursor.execute('''
                            INSERT INTO inventory (id, nome, categoria, quantidade_atual, meta_minima, unidade, descricao, ultima_atualizacao, atualizado_por)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                            ON CONFLICT(id) DO UPDATE SET
                                nome = excluded.nome,
                                categoria = excluded.categoria,
                                quantidade_atual = excluded.quantidade_atual,
                                meta_minima = excluded.meta_minima,
                                unidade = excluded.unidade,
                                descricao = excluded.descricao,
                                ultima_atualizacao = excluded.ultima_atualizacao,
                                atualizado_por = excluded.atualizado_por
                        ''', (item_id, nome, categoria, quantidade_atual, meta_minima, unidade, descricao, now_ms, atualizado_por))

                    if session:
                        cursor.execute('''
                            INSERT INTO audit_logs (admin_steam_hex, admin_nome, action_type, target_id, description, timestamp, ip_address)
                            VALUES (?, ?, 'INVENTORY_BATCH_UPDATE', 'all', ?, ?, ?)
                        ''', (session['steam_hex'], session['nome'], f"Balanço de estoque atualizado ({len(items)} itens)", now_ms, client_ip))
                    conn.commit()

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"ok": True, "count": len(items)}).encode('utf-8'))
                return

            if path.endswith('/inventory/transactions'):
                session = self._get_auth_session()
                secret_provided = (
                    data.get('secret', '')
                    or self.headers.get('X-Admin-Secret', '')
                    or self.headers.get('Authorization', '').replace('Bearer ', '')
                )
                if not self._is_manager_or_dono(session, secret_provided):
                    self.send_response(403)
                    self.send_header('Content-Type', 'application/json')
                    self._send_cors_headers()
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": "Acesso negado. Apenas Gerentes e Donos podem registrar movimentações do Baú."}).encode('utf-8'))
                    return

                t_id = str(data.get('id') or f"trans-{int(time.time()*1000)}")
                item_id = str(data.get('itemId', ''))
                item_nome = str(data.get('itemNome', ''))[:128]
                tipo = str(data.get('tipo', 'retirada'))[:32]
                quantidade = max(1, int(data.get('quantidade', 1)))
                mecanico_nome = str(data.get('mecanicoNome') or (session['nome'] if session else 'Mecanico'))[:128]
                mecanico_hex = str(data.get('mecanicoSteamHex') or (session['steam_hex'] if session else ''))[:64]
                mecanico_discord = str(data.get('mecanicoDiscord') or '')[:128]
                data_hora_str = str(data.get('dataHoraStr') or datetime.datetime.now(BRT_TZ).strftime('%d/%m/%Y | %H:%M'))
                now_ms = int(time.time() * 1000)
                observacao = str(data.get('observacao', ''))[:256]

                with get_db_connection() as conn:
                    cursor = conn.cursor()
                    cursor.execute('''
                        INSERT INTO inventory_transactions (id, item_id, item_nome, tipo, quantidade, mecanico_nome, mecanico_discord, mecanico_steam_hex, data_hora_str, timestamp, observacao)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (t_id, item_id, item_nome, tipo, quantidade, mecanico_nome, mecanico_discord, mecanico_hex, data_hora_str, now_ms, observacao))
                    conn.commit()

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"ok": True, "id": t_id}).encode('utf-8'))
                return

            if path.endswith('/members') or path.endswith('/members/register'):
                session = self._get_auth_session()
                secret_provided = (
                    data.get('secret', '')
                    or self.headers.get('X-Admin-Secret', '')
                    or (self.headers.get('Authorization', '').replace('Bearer ', '') if not session else '')
                )
                origin = self.headers.get('Origin', '')
                allowed_from_app = is_origin_allowed(origin)
                if not self._is_manager_or_dono(session, secret_provided) and not (session and allowed_from_app):
                    self.send_response(403)
                    self.send_header('Content-Type', 'application/json')
                    self._send_cors_headers()
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": "Acesso negado. Apenas Gerentes e Donos podem cadastrar ou editar membros."}).encode('utf-8'))
                    return

                steam_hex = str(data.get('steamHex', '')).strip().lower()
                if steam_hex and not steam_hex.startswith('steam:'):
                    steam_hex = f"steam:{steam_hex}"
                if steam_hex in IGNORED_STAFF_HEXES:
                    self.send_response(400)
                    self.send_header('Content-Type', 'application/json')
                    self._send_cors_headers()
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": "Este identificador pertence à Staff e é ignorado no cadastro."}).encode('utf-8'))
                    return

                nome = clean_member_name(str(data.get('nome', '')).strip()[:128])
                cargo = str(data.get('cargo') or data.get('role') or 'aprendiz')[:32]
                avatar_url = str(data.get('avatarUrl', ''))[:500]
                now_ms = int(time.time() * 1000)
                updated_by = session['nome'] if session else 'Dono'

                if steam_hex and nome:
                    with get_db_connection() as conn:
                        cursor = conn.cursor()
                        cursor.execute('''
                            INSERT INTO funcionarios (steam_hex, nome, avatar_url, ativo, last_synced_at)
                            VALUES (?, ?, ?, 1, ?)
                            ON CONFLICT(steam_hex) DO UPDATE SET
                                nome = excluded.nome,
                                avatar_url = CASE WHEN excluded.avatar_url != '' THEN excluded.avatar_url ELSE funcionarios.avatar_url END,
                                ativo = 1,
                                last_synced_at = excluded.last_synced_at
                        ''', (steam_hex, nome, avatar_url, now_ms))

                        cursor.execute('''
                            INSERT INTO member_roles (steam_hex, cargo, updated_at, updated_by)
                            VALUES (?, ?, ?, ?)
                            ON CONFLICT(steam_hex) DO UPDATE SET
                                cargo = excluded.cargo,
                                updated_at = excluded.updated_at,
                                updated_by = excluded.updated_by
                        ''', (steam_hex, cargo, now_ms, updated_by))

                        if session:
                            cursor.execute('''
                                INSERT INTO audit_logs (admin_steam_hex, admin_nome, action_type, target_id, description, timestamp, ip_address)
                                VALUES (?, ?, 'MEMBER_REGISTER', ?, ?, ?, ?)
                            ''', (session['steam_hex'], session['nome'], steam_hex, f"Membro {nome} ({cargo})", now_ms, client_ip))
                        conn.commit()

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"ok": True, "steamHex": steam_hex, "nome": nome, "cargo": cargo}).encode('utf-8'))
                return

            if path.endswith('/members/roles'):
                session = self._get_auth_session()
                secret_provided = (
                    data.get('secret', '')
                    or self.headers.get('X-Admin-Secret', '')
                    or (self.headers.get('Authorization', '').replace('Bearer ', '') if not session else '')
                )
                origin = self.headers.get('Origin', '')
                allowed_from_app = is_origin_allowed(origin)
                if not self._is_manager_or_dono(session, secret_provided) and not (session and allowed_from_app):
                    self.send_response(403)
                    self.send_header('Content-Type', 'application/json')
                    self._send_cors_headers()
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": "Acesso negado. Apenas Gerentes e Donos podem alterar cargos."}).encode('utf-8'))
                    return

                steam_hex = str(data.get('steamHex', ''))[:64]
                cargo = str(data.get('role') or data.get('cargo') or 'auxiliar')[:32]
                now_ms = int(time.time() * 1000)
                updated_by = session['nome'] if session else 'Dono'

                if steam_hex:
                    with get_db_connection() as conn:
                        cursor = conn.cursor()
                        cursor.execute('''
                            INSERT INTO member_roles (steam_hex, cargo, updated_at, updated_by)
                            VALUES (?, ?, ?, ?)
                            ON CONFLICT(steam_hex) DO UPDATE SET
                                cargo = excluded.cargo,
                                updated_at = excluded.updated_at,
                                updated_by = excluded.updated_by
                        ''', (steam_hex, cargo, now_ms, updated_by))

                        if session:
                            cursor.execute('''
                                INSERT INTO audit_logs (admin_steam_hex, admin_nome, action_type, target_id, description, timestamp, ip_address)
                                VALUES (?, ?, 'ROLE_UPDATE', ?, ?, ?, ?)
                            ''', (session['steam_hex'], session['nome'], steam_hex, f"Cargo atualizado para {cargo}", now_ms, client_ip))
                        conn.commit()

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"ok": True}).encode('utf-8'))
                return

            if path.endswith('/members/discord'):
                session = self._get_auth_session()
                secret_provided = (
                    data.get('secret', '')
                    or self.headers.get('X-Admin-Secret', '')
                    or self.headers.get('Authorization', '').replace('Bearer ', '')
                )
                if not self._is_manager_or_dono(session, secret_provided):
                    self.send_response(403)
                    self.send_header('Content-Type', 'application/json')
                    self._send_cors_headers()
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": "Acesso negado. Apenas Gerentes e Donos podem atualizar Discord ID."}).encode('utf-8'))
                    return

                steam_hex = str(data.get('steamHex', '')).strip()
                raw_id = str(data.get('discordId', '')).strip()
                m_dig = re.search(r'\d{17,20}', raw_id)
                discord_id = m_dig.group(0) if m_dig else ''
                if discord_id in DISCORD_BOT_IDS:
                    self.send_response(400)
                    self.send_header('Content-Type', 'application/json')
                    self._send_cors_headers()
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": "O ID informado pertence ao bot do Discord (Spidey Bot / Captain Hook) e não pode ser atribuído a um membro."}).encode('utf-8'))
                    return

                now_ms = int(time.time() * 1000)
                updated_by = session['nome'] if session else 'Dono'

                if steam_hex:
                    with get_db_connection() as conn:
                        cursor = conn.cursor()
                        cursor.execute('''
                            INSERT INTO member_roles (steam_hex, cargo, updated_at, updated_by, discord_id)
                            VALUES (?, 'aprendiz', ?, ?, ?)
                            ON CONFLICT(steam_hex) DO UPDATE SET
                                discord_id = excluded.discord_id,
                                updated_at = excluded.updated_at,
                                updated_by = excluded.updated_by
                        ''', (steam_hex, now_ms, updated_by, discord_id))
                        conn.commit()

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"ok": True, "steamHex": steam_hex, "discordId": discord_id}).encode('utf-8'))
                return

            if path.endswith('/members/delete'):
                session = self._get_auth_session()
                secret_provided = (
                    data.get('secret', '')
                    or self.headers.get('X-Admin-Secret', '')
                    or self.headers.get('Authorization', '').replace('Bearer ', '')
                )
                if not self._is_manager_or_dono(session, secret_provided):
                    self.send_response(403)
                    self.send_header('Content-Type', 'application/json')
                    self._send_cors_headers()
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": "Acesso negado. Apenas Gerentes e Donos podem remover membros."}).encode('utf-8'))
                    return

                target_hex = str(data.get('steamHex', '')).strip().lower()
                if target_hex and not target_hex.startswith('steam:'):
                    target_hex = f"steam:{target_hex}"
                now_ms = int(time.time() * 1000)

                if target_hex:
                    with get_db_connection() as conn:
                        cursor = conn.cursor()
                        cursor.execute('DELETE FROM funcionarios WHERE LOWER(steam_hex) = LOWER(?)', (target_hex,))
                        cursor.execute('DELETE FROM member_roles WHERE LOWER(steam_hex) = LOWER(?)', (target_hex,))
                        cursor.execute('DELETE FROM work_hours WHERE LOWER(mecanico_steam_hex) = LOWER(?)', (target_hex,))
                        if session:
                            cursor.execute('''
                                INSERT INTO audit_logs (admin_steam_hex, admin_nome, action_type, target_id, description, timestamp, ip_address)
                                VALUES (?, ?, 'MEMBER_DELETE', ?, ?, ?, ?)
                            ''', (session['steam_hex'], session['nome'], target_hex, f"Membro {target_hex} removido", now_ms, client_ip))
                        conn.commit()

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"ok": True, "deleted": target_hex}).encode('utf-8'))
                return

            if path.endswith('/work-hours/reset-week') or path.endswith('/work-hours/reset'):
                session = self._get_auth_session()
                secret_provided = (
                    data.get('secret', '')
                    or self.headers.get('X-Admin-Secret', '')
                    or self.headers.get('Authorization', '').replace('Bearer ', '')
                )
                if not self._is_manager_or_dono(session, secret_provided):
                    self.send_response(403)
                    self.send_header('Content-Type', 'application/json')
                    self._send_cors_headers()
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": "Acesso negado. Apenas Gerentes e Donos podem resetar a semana."}).encode('utf-8'))
                    return

                now_ms = int(time.time() * 1000)
                now_dt = datetime.datetime.now(BRT_TZ)
                cycle_id = f"cycle_{now_ms}"
                cycle_label = f"Semana encerrada em {now_dt.strftime('%d/%m/%Y %H:%M')}"

                start_counting_at = data.get('startCountingAt') if isinstance(data, dict) else None
                start_counting_ms = None
                if isinstance(start_counting_at, (int, float)) and start_counting_at > 0:
                    start_counting_ms = int(start_counting_at)
                elif start_counting_at == 'now':
                    start_counting_ms = now_ms
                else:
                    days_ahead = (0 - now_dt.weekday()) % 7
                    if days_ahead == 0 and now_dt.hour >= 6:
                        days_ahead = 7
                    next_monday_dt = (now_dt + datetime.timedelta(days=days_ahead)).replace(hour=6, minute=0, second=0, microsecond=0)
                    start_counting_ms = int(next_monday_dt.timestamp() * 1000)

                start_counting_str = datetime.datetime.fromtimestamp(start_counting_ms/1000, BRT_TZ).strftime('%d/%m/%Y %H:%M')

                with get_db_connection() as conn:
                    cursor = conn.cursor()
                    cursor.execute('''
                        SELECT id, mecanico_steam_hex, mecanico_nome, cargo, entrada_timestamp, saida_timestamp, duracao_minutos, status, turno, data_str, horario_entrada_str, horario_saida_str, observacao
                        FROM work_hours
                    ''')
                    current_rows = cursor.fetchall()

                    if current_rows:
                        valid_ts = [r[4] for r in current_rows if r[4]]
                        if valid_ts:
                            start_dt_str = datetime.datetime.fromtimestamp(min(valid_ts)/1000, BRT_TZ).strftime('%d/%m')
                            end_dt_str = datetime.datetime.fromtimestamp(now_ms/1000, BRT_TZ).strftime('%d/%m/%Y')
                            cycle_label = f"Semana {start_dt_str} a {end_dt_str}"

                        cursor.execute('SELECT steam_hex, cargo FROM member_roles')
                        member_roles_map = {row[0].lower(): row[1] for row in cursor.fetchall() if row[0] and row[1]}

                        mecanicos_map = {}
                        for r in current_rows:
                            hex_id = (r[1] or '').strip().lower()
                            if not hex_id:
                                continue
                            if hex_id not in mecanicos_map:
                                official_cargo = member_roles_map.get(hex_id) or r[3] or 'auxiliar'
                                mecanicos_map[hex_id] = {
                                    "steamHex": r[1],
                                    "nome": r[2],
                                    "cargo": official_cargo,
                                    "totalMinutos": 0,
                                    "diasSet": set()
                                }
                            dur = r[6] or 0
                            mecanicos_map[hex_id]["totalMinutos"] += dur
                            if r[9]:
                                mecanicos_map[hex_id]["diasSet"].add(r[9])

                        ranking_list = []
                        total_cycle_minutos = 0
                        for m in mecanicos_map.values():
                            total_cycle_minutos += m["totalMinutos"]
                            ranking_list.append({
                                "steamHex": m["steamHex"],
                                "nome": m["nome"],
                                "cargo": m["cargo"],
                                "totalMinutos": m["totalMinutos"],
                                "diasTrabalhados": len(m["diasSet"])
                            })
                        ranking_list.sort(key=lambda x: x["totalMinutos"], reverse=True)
                        role_labels = {
                            "dono": "Dono", "gerente": "Gerente", "supervisor": "Supervisor",
                            "profissional": "Profissional", "auxiliar": "Auxiliar", "aprendiz": "Aprendiz"
                        }
                        for idx, item in enumerate(ranking_list):
                            item["posicao"] = idx + 1
                            tot_min = item.get("totalMinutos", 0)
                            item["totalFormatado"] = f"{tot_min // 60}h {tot_min % 60:02d}min"
                            cargo = (item.get("cargo") or "auxiliar").lower()
                            item["cargoLabel"] = role_labels.get(cargo, cargo.capitalize())

                        admin_hex = session['steam_hex'] if session else ''
                        admin_nome = session['nome'] if session else 'Admin'
                        min_ts = min(valid_ts) if valid_ts else now_ms

                        cursor.execute('''
                            INSERT INTO work_hours_cycles (id, label, start_timestamp, end_timestamp, archived_at, archived_by_hex, archived_by_nome, total_hours_minutos, total_membros, ranking_json)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ''', (cycle_id, cycle_label, min_ts, now_ms, now_ms, admin_hex, admin_nome, total_cycle_minutos, len(ranking_list), json.dumps(ranking_list)))

                        for r in current_rows:
                            hex_id = (r[1] or '').strip().lower()
                            official_cargo = member_roles_map.get(hex_id) or r[3] or 'auxiliar'
                            cursor.execute('''
                                INSERT INTO work_hours_archive (id, cycle_id, mecanico_steam_hex, mecanico_nome, cargo, entrada_timestamp, saida_timestamp, duracao_minutos, status, turno, data_str, horario_entrada_str, horario_saida_str, observacao)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            ''', (r[0], cycle_id, r[1], r[2], official_cargo, r[4], r[5], r[6], r[7], r[8], r[9], r[10], r[11], r[12]))

                    cursor.execute('DELETE FROM work_hours')

                    # Registra a configuração de início da contagem oficial no SQLite
                    admin_nome = session['nome'] if session else 'Admin'
                    cursor.execute('''
                        INSERT INTO system_settings (key, value, updated_at, updated_by)
                        VALUES ('work_hours_cycle_start_ms', ?, ?, ?)
                        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by
                    ''', (str(start_counting_ms), now_ms, admin_nome))

                    if session:
                        cursor.execute('''
                            INSERT INTO audit_logs (admin_steam_hex, admin_nome, action_type, target_id, description, timestamp, ip_address)
                            VALUES (?, ?, 'WORK_HOURS_RESET_WEEK', ?, ?, ?, ?)
                        ''', (session['steam_hex'], session['nome'], cycle_id, f'Reset semanal executado. Ciclo arquivado: {cycle_label}. Nova contagem inicia em: {start_counting_str}', now_ms, client_ip))
                    conn.commit()

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({
                    "ok": True,
                    "reset": True,
                    "cycle_id": cycle_id,
                    "label": cycle_label,
                    "startCountingAt": start_counting_ms,
                    "message": f"Semana arquivada ({cycle_label}) e resetada com sucesso. Nova contagem inicia em {start_counting_str}"
                }).encode('utf-8'))
                return

            if path.endswith('/work-hours/batch') or path.endswith('/work-hours'):
                session = self._get_auth_session()
                secret_provided = (
                    data.get('secret', '')
                    or self.headers.get('X-Admin-Secret', '')
                    or self.headers.get('Authorization', '').replace('Bearer ', '')
                )
                if not self._is_manager_or_dono(session, secret_provided):
                    self.send_response(403)
                    self.send_header('Content-Type', 'application/json')
                    self._send_cors_headers()
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": "Acesso negado. Apenas Gerentes e Donos podem registrar ou importar pontos."}).encode('utf-8'))
                    return

                entries = data.get('entries', [])
                if not entries and isinstance(data, dict) and ('mecanicoSteamHex' in data or 'duracaoMinutos' in data):
                    entries = [data]
                now_ms = int(time.time() * 1000)
                with get_db_connection() as conn:
                    cursor = conn.cursor()
                    for entry in entries:
                        e_id = str(entry.get('id') or f"tc-{int(time.time()*1000)}-{secrets.token_hex(4)}")
                        m_hex = str(entry.get('mecanicoSteamHex', ''))[:64]
                        m_nome = clean_member_name(str(entry.get('mecanicoNome', 'Mecanico'))[:128])
                        m_discord = str(entry.get('mecanicoDiscord', ''))[:128]
                        cargo = str(entry.get('cargo', 'profissional'))[:32]
                        entrada_ts = int(entry.get('entradaTimestamp') or now_ms)
                        saida_ts = int(entry['saidaTimestamp']) if entry.get('saidaTimestamp') else None
                        duracao = int(entry.get('duracaoMinutos', 0))
                        status = str(entry.get('status', 'finalizado'))[:32]
                        turno = str(entry.get('turno', 'noite'))[:32]
                        data_str = str(entry.get('dataStr', ''))[:32]
                        entrada_str = str(entry.get('horarioEntradaStr', ''))[:32]
                        saida_str = str(entry.get('horarioSaidaStr', ''))[:32] if entry.get('horarioSaidaStr') else None
                        criado_manualmente = 1 if entry.get('criadoManualmente') else 0
                        observacao = str(entry.get('observacao', ''))[:256]

                        cursor.execute('''
                            INSERT INTO work_hours (id, mecanico_steam_hex, mecanico_nome, mecanico_discord, cargo, entrada_timestamp, saida_timestamp, duracao_minutos, status, turno, data_str, horario_entrada_str, horario_saida_str, criado_manualmente, observacao)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            ON CONFLICT(id) DO UPDATE SET
                                mecanico_nome = excluded.mecanico_nome,
                                cargo = excluded.cargo,
                                duracao_minutos = excluded.duracao_minutos,
                                status = excluded.status,
                                turno = excluded.turno,
                                data_str = excluded.data_str,
                                horario_entrada_str = excluded.horario_entrada_str,
                                entrada_timestamp = excluded.entrada_timestamp,
                                saida_timestamp = excluded.saida_timestamp,
                                horario_saida_str = excluded.horario_saida_str,
                                criado_manualmente = excluded.criado_manualmente,
                                observacao = excluded.observacao
                        ''', (e_id, m_hex, m_nome, m_discord, cargo, entrada_ts, saida_ts, duracao, status, turno, data_str, entrada_str, saida_str, criado_manualmente, observacao))
                    conn.commit()

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"ok": True, "count": len(entries)}).encode('utf-8'))
                return
            if path.endswith('/discord-live-log'):
                log_data = data.get('log') or data
                if isinstance(log_data, list):
                    results = [process_live_discord_log(item) for item in log_data]
                    res = {"ok": True, "processed": len(results), "results": results}
                else:
                    res = process_live_discord_log(log_data)
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps(res).encode('utf-8'))
                return

            if path.endswith('/faturas/sync-history'):
                session = self._get_auth_session()
                secret_provided = (
                    data.get('secret', '')
                    or self.headers.get('X-Admin-Secret', '')
                    or self.headers.get('Authorization', '').replace('Bearer ', '')
                )
                if not self._is_manager_or_dono(session, secret_provided):
                    self.send_response(403)
                    self.send_header('Content-Type', 'application/json')
                    self._send_cors_headers()
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": "Acesso negado. Apenas Gerentes e Donos podem sincronizar histórico."}).encode('utf-8'))
                    return

                limit_val = min(1000, max(50, int(data.get('limit', 500))))
                ok, count = sync_invoices_from_discord(limit_val)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"ok": ok, "imported": count}).encode('utf-8'))
                return

            if path in ('/api/telemetry', '/telemetry', ''):
                timestamp = int(data.get('timestamp') or time.time() * 1000)
                success = 1 if data.get('success', True) else 0
                duration_ms = int(data.get('durationMs', 1400))
                model = str(data.get('model', 'gemini-3.5-flash-lite'))[:64]
                placa = str(data.get('placa', ''))[:32]
                modelo = str(data.get('modelo', ''))[:128]
                servico = str(data.get('servico', 'Troca de oleo e filtro'))[:256]
                service_mode = str(data.get('serviceMode', 'oleo'))[:32]
                mechanic_steam_hex = str(data.get('mechanicSteamHex') or '')[:64]
                mechanic_name = str(data.get('mechanicName') or '')[:128]
                gpu_model = str(data.get('gpuModel') or '')[:128]
                hardware_info = str(data.get('hardwareInfo') or '')[:256]

                with get_db_connection() as conn:
                    cursor = conn.cursor()
                    cursor.execute('''
                        INSERT INTO extractions (timestamp, success, duration_ms, model, placa, modelo, servico, service_mode, mechanic_steam_hex, mechanic_name, gpu_model, hardware_info)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (timestamp, success, duration_ms, model, placa, modelo, servico, service_mode, mechanic_steam_hex, mechanic_name, gpu_model, hardware_info))
                    conn.commit()

                response_bytes = json.dumps({"ok": True}).encode('utf-8')
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(response_bytes)
                return

            self.send_response(404)
            self.send_header('Content-Type', 'application/json')
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({"error": f"Endpoint POST não encontrado: {path}"}).encode('utf-8'))

        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))

    def do_DELETE(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        client_ip = self._get_client_ip()

        session = self._get_auth_session()
        secret_provided = (
            self.headers.get('X-Admin-Secret', '')
            or (self.headers.get('Authorization', '').replace('Bearer ', '') if not session else '')
        )
        if not self._is_manager_or_dono(session, secret_provided):
            self.send_response(403)
            self.send_header('Content-Type', 'application/json')
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Acesso negado. Apenas Gerentes e Donos autorizados podem executar exclusões."}).encode('utf-8'))
            return

        if '/inventory/items/' in path:
            item_id = path.split('/inventory/items/')[-1].strip('/')
            if item_id:
                with get_db_connection() as conn:
                    cursor = conn.cursor()
                    cursor.execute('DELETE FROM inventory WHERE id = ?', (item_id,))
                    if session:
                        cursor.execute('''
                            INSERT INTO audit_logs (admin_steam_hex, admin_nome, action_type, target_id, description, timestamp, ip_address)
                            VALUES (?, ?, 'INVENTORY_DELETE', ?, ?, ?, ?)
                        ''', (session['steam_hex'], session['nome'], item_id, f"Remocao do item {item_id}", int(time.time()*1000), client_ip))
                    conn.commit()

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({"ok": True, "deleted": item_id}).encode('utf-8'))
            return

        if '/members/' in path or path.endswith('/members'):
            target_hex = ''
            if '/members/' in path:
                target_hex = urllib.parse.unquote(path.split('/members/')[-1].strip('/'))
            if not target_hex and parsed_url.query:
                q = urllib.parse.parse_qs(parsed_url.query)
                target_hex = q.get('steamHex', [''])[0]

            target_hex = target_hex.strip().lower()
            if target_hex and not target_hex.startswith('steam:'):
                target_hex = f"steam:{target_hex}"

            if target_hex:
                with get_db_connection() as conn:
                    cursor = conn.cursor()
                    cursor.execute('DELETE FROM funcionarios WHERE LOWER(steam_hex) = LOWER(?)', (target_hex,))
                    cursor.execute('DELETE FROM member_roles WHERE LOWER(steam_hex) = LOWER(?)', (target_hex,))
                    cursor.execute('DELETE FROM work_hours WHERE LOWER(mecanico_steam_hex) = LOWER(?)', (target_hex,))
                    if session:
                        cursor.execute('''
                            INSERT INTO audit_logs (admin_steam_hex, admin_nome, action_type, target_id, description, timestamp, ip_address)
                            VALUES (?, ?, 'MEMBER_DELETE', ?, ?, ?, ?)
                        ''', (session['steam_hex'], session['nome'], target_hex, f"Membro {target_hex} removido", int(time.time()*1000), client_ip))
                    conn.commit()

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({"ok": True, "deleted": target_hex}).encode('utf-8'))
            return

        if '/work-hours/' in path:
            entry_id = path.split('/work-hours/')[-1].strip('/')
            if entry_id:
                with get_db_connection() as conn:
                    cursor = conn.cursor()
                    cursor.execute('DELETE FROM work_hours WHERE id = ?', (entry_id,))
                    if session:
                        cursor.execute('''
                            INSERT INTO audit_logs (admin_steam_hex, admin_nome, action_type, target_id, description, timestamp, ip_address)
                            VALUES (?, ?, 'WORK_HOURS_DELETE', ?, ?, ?, ?)
                        ''', (session['steam_hex'], session['nome'], entry_id, f"Registro de ponto {entry_id} removido", int(time.time()*1000), client_ip))
                    conn.commit()

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({"ok": True, "deleted": entry_id}).encode('utf-8'))
            return

        self.send_response(404)
        self.end_headers()

def run_server(port=8002):
    if not ADMIN_SECRET:
        safe_log("[FATAL] ADMIN_SECRET não configurado via variável de ambiente. Abortando inicialização por segurança.")
        sys.exit(1)
    if not STEAM_API_KEY:
        safe_log("[FATAL] STEAM_API_KEY não configurada via variável de ambiente. Abortando inicialização por segurança.")
        sys.exit(1)

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
