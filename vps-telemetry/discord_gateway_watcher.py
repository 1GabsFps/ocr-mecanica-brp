import asyncio
import json
import time
import os
import sys
import datetime
import requests
import websockets

def load_dotenv():
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
    if os.path.isfile(env_path):
        try:
            with open(env_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        k, v = line.split('=', 1)
                        if k.strip() not in os.environ:
                            os.environ[k.strip()] = v.strip().strip('"').strip("'")
        except Exception:
            pass

load_dotenv()

TOKEN = os.environ.get('DISCORD_TOKEN')
if not TOKEN:
    print("[FATAL] DISCORD_TOKEN não configurado no ambiente. Abortando watcher.")
    sys.exit(1)

CHANNEL_HOURS = '1389258368509542584'
CHANNEL_INVENTORY = '1389258280962101388'
CHANNEL_INVOICES = '1389258314818257049'
TARGET_CHANNELS = {CHANNEL_HOURS, CHANNEL_INVENTORY, CHANNEL_INVOICES}

API_ENDPOINT = 'http://127.0.0.1:8002/api/discord-live-log'
GATEWAY_URL = 'wss://gateway.discord.gg/?v=9&encoding=json'

PROCESSED_IDS = set()

def forward_log_to_api(log_item):
    msg_id = log_item.get('id', '')
    if msg_id and msg_id in PROCESSED_IDS:
        return
    if msg_id:
        PROCESSED_IDS.add(msg_id)
        if len(PROCESSED_IDS) > 20000:
            PROCESSED_IDS.clear()

    try:
        r = requests.post(API_ENDPOINT, json={'log': log_item}, timeout=5)
        print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] [Sync API] Status: {r.status_code} - {r.text[:100]}")
    except Exception as e:
        print(f"[Sync API Error] {e}")

def handle_message_create(data):
    channel_id = str(data.get('channel_id', ''))
    if channel_id not in TARGET_CHANNELS:
        return

    msg_id = str(data.get('id', ''))
    content = str(data.get('content', ''))
    author = data.get('author', {})
    member = data.get('member', {})
    author_id = str(author.get('id', ''))
    author_username = str(author.get('username', ''))
    author_global_name = str(author.get('global_name', ''))
    author_nick = str(member.get('nick') or '')

    embeds = data.get('embeds', [])
    timestamp_str = data.get('timestamp', '')

    ts_ms = int(time.time() * 1000)
    if timestamp_str:
        try:
            dt = datetime.datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
            ts_ms = int(dt.timestamp() * 1000)
        except Exception:
            pass

    embed_data = None
    if embeds and len(embeds) > 0:
        emb = embeds[0]
        fields = [{'name': f.get('name', ''), 'value': f.get('value', '')} for f in emb.get('fields', [])]
        embed_data = {
            'title': emb.get('title', ''),
            'description': emb.get('description', ''),
            'fields': fields,
            'footer': emb.get('footer', {}).get('text', '') if isinstance(emb.get('footer'), dict) else ''
        }

    if channel_id == CHANNEL_HOURS:
        channel_name = 'PONTO'
    elif channel_id == CHANNEL_INVENTORY:
        channel_name = 'BAU'
    elif channel_id == CHANNEL_INVOICES:
        channel_name = 'FATURAS'
    else:
        channel_name = channel_id

    display_author = author_nick or author_global_name or author_username
    print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] [Discord Event] Canal: {channel_name} ({channel_id}) | Autor: {display_author}")

    log_item = {
        'id': msg_id,
        'rawText': content,
        'embed': embed_data,
        'timestampMs': ts_ms,
        'author': author_username,
        'authorId': author_id,
        'authorNick': author_nick,
        'authorGlobalName': author_global_name,
        'channelId': channel_id
    }

    forward_log_to_api(log_item)

async def heartbeat(ws, interval_ms):
    while True:
        await asyncio.sleep(interval_ms / 1000)
        try:
            await ws.send(json.dumps({'op': 1, 'd': None}))
        except Exception:
            break

async def run_watcher():
    reconnect_delay = 3
    while True:
        try:
            print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] [Gateway] Conectando ao Discord Gateway...")
            async with websockets.connect(GATEWAY_URL, max_size=50 * 1024 * 1024) as ws:
                hello = json.loads(await ws.recv())
                heartbeat_interval = hello['d']['heartbeat_interval']
                print(f"[Gateway] Conectado com sucesso! Heartbeat: {heartbeat_interval}ms")

                asyncio.create_task(heartbeat(ws, heartbeat_interval))

                identify_payload = {
                    'op': 2,
                    'd': {
                        'token': TOKEN,
                        'capabilities': 16381,
                        'properties': {
                            'os': 'Windows',
                            'browser': 'Discord Client',
                            'release_channel': 'stable',
                            'client_version': '1.0.9168',
                            'os_version': '10.0.19045',
                            'os_arch': 'x64',
                            'system_locale': 'pt-BR'
                        },
                        'presence': {
                            'status': 'unknown',
                            'since': 0,
                            'activities': [],
                            'afk': False
                        }
                    }
                }
                await ws.send(json.dumps(identify_payload))
                print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] [Gateway] Autenticacao enviada. Monitorando canais 24/7...")

                reconnect_delay = 3

                while True:
                    raw = await ws.recv()
                    msg = json.loads(raw)
                    op = msg.get('op')
                    t = msg.get('t')

                    if op == 0 and t == 'MESSAGE_CREATE':
                        handle_message_create(msg.get('d', {}))
                    elif op == 0 and t == 'READY':
                        user = msg['d']['user']
                        print(f"[Gateway] ONLINE e Ativo! Sessao: {user.get('username')} (ID: {user.get('id')})")
                    elif op == 7 or op == 9:
                        print(f"[Gateway] Servidor solicitou reconexao (op={op})")
                        break

        except Exception as e:
            print(f"[Gateway Disconnect] {e}. Reconectando em {reconnect_delay}s...")
            await asyncio.sleep(reconnect_delay)
            reconnect_delay = min(60, reconnect_delay * 1.5)

if __name__ == '__main__':
    asyncio.run(run_watcher())
