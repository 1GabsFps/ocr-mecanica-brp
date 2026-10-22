import sqlite3, time, unicodedata

def normalize(text):
    if not text: return ""
    text = unicodedata.normalize('NFKD', text)
    text = "".join([c for c in text if not unicodedata.combining(c)])
    return " ".join(text.lower().strip().split())

active_roster = [
    ("Gabriel Loret", "steam:1100001145b8f52", "aprendiz"),
    ("Joao Santos", None, "gerente"),
    ("Stivao Stafio leal", None, "dono"),
    ("Vincent Montgomery", None, "gerente"),
    ("Adeilton Ferreira", None, "profissional"),
    ("Apolo Sanduba", None, "auxiliar"),
    ("Bruno Chipito", None, "aprendiz"),
    ("Carimbo Rostand", None, "profissional"),
    ("Carlos Daniel", None, "auxiliar"),
    ("Cidoka Sousa", None, "auxiliar"),
    ("Davasco Mottu", None, "profissional"),
    ("Dean Cooper", None, "auxiliar"),
    ("Eduardo Makarov", None, "profissional"),
    ("Fabio Henrique", None, "auxiliar"),
    ("Felipe Laurent", None, "profissional"),
    ("Gabriel Alexandre", None, "auxiliar"),
    ("Gabriel Martims", None, "profissional"),
    ("Gajeel Wingates", None, "profissional"),
    ("Iran De santana pedre", None, "profissional"),
    ("Jackson Wolf", None, "profissional"),
    ("Joao Vitor", "steam:110000114eaf4bb", "aprendiz"),
    ("João Carabina", "steam:110000133e97ade", "profissional"),
    ("João Green", None, "profissional"),
    ("Joao Makarov", "steam:110000143dbc773", "profissional"),
    ("Jobson Mayländer", None, "profissional"),
    ("John Dravelli", None, "auxiliar"),
    ("John Jones", None, "profissional"),
    ("Jonas Molina", None, "auxiliar"),
    ("Kristofh Postura", None, "profissional"),
    ("Livia Araujo", None, "gerente"),
    ("Marcos Portela", None, "auxiliar"),
    ("Matheus Leal", "steam:11000014b5f7e8a", "profissional"),
    ("Natanzinho Lima", None, "profissional"),
    ("Nathalia Tempest", None, "auxiliar"),
    ("Paulinho Junior", None, "auxiliar"),
    ("Pe Alks", None, "aprendiz"),
    ("Renato Neves", None, "aprendiz"),
    ("Rogi Lael", None, "profissional"),
    ("Sadrac Beiramar", None, "auxiliar"),
    ("Scott Delacruz", None, "profissional"),
    ("Thomas Gucci", None, "auxiliar"),
    ("Tommy Raminhos", None, "auxiliar"),
    ("Tony Redgrave", None, "auxiliar"),
    ("Vei chibungo Oliveira", None, "profissional"),
    ("Veio Pobre", None, "profissional"),
    ("Ze Comeia", "steam:11000013aa49281", "dono")
]

conn = sqlite3.connect('/home/ubuntu/mec-telemetry/data/telemetry.db')
c = conn.cursor()

c.execute('SELECT steam_hex, nome, avatar_url FROM funcionarios')
f_rows = c.fetchall()
f_map = {}
for h, n, a in f_rows:
    f_map[normalize(n)] = (h, n, a)

c.execute('SELECT DISTINCT mecanico_steam_hex, mecanico_nome FROM work_hours')
w_rows = c.fetchall()
for h, n in w_rows:
    norm = normalize(n)
    if norm not in f_map:
        f_map[norm] = (h, n, '')

resolved_roster = []
now_ms = int(time.time() * 1000)

for nome, fixed_hex, cargo in active_roster:
    steam_hex = fixed_hex
    avatar_url = ''
    real_nome = nome
    
    if not steam_hex:
        norm = normalize(nome)
        if norm in f_map:
            steam_hex, real_nome, avatar_url = f_map[norm]
        else:
            for k, v in f_map.items():
                if norm in k or k in norm:
                    steam_hex, real_nome, avatar_url = v
                    break
    
    if not steam_hex:
        print(f"ERRO: Nao encontrou steam_hex para {nome}")
    else:
        resolved_roster.append((steam_hex, nome, cargo, avatar_url))

print(f"Resolvidos {len(resolved_roster)} membros com Steam Hex!")

# Limpa a tabela funcionarios e reinsere apenas os 46 oficiais
c.execute('DELETE FROM funcionarios')

for s_hex, s_nome, s_cargo, s_avatar in resolved_roster:
    c.execute('''
        INSERT INTO funcionarios (steam_hex, nome, avatar_url, ativo, last_synced_at)
        VALUES (?, ?, ?, 1, ?)
    ''', (s_hex, s_nome, s_avatar, now_ms))
    
    c.execute('''
        INSERT INTO member_roles (steam_hex, cargo, updated_at, updated_by)
        VALUES (?, ?, ?, 'Sistema/Dono')
        ON CONFLICT(steam_hex) DO UPDATE SET
            cargo = excluded.cargo,
            updated_at = excluded.updated_at,
            updated_by = excluded.updated_by
    ''', (s_hex, s_cargo, now_ms))

conn.commit()

c.execute('''
    SELECT f.nome, f.steam_hex, r.cargo
    FROM funcionarios f
    JOIN member_roles r ON LOWER(f.steam_hex) = LOWER(r.steam_hex)
    ORDER BY CASE r.cargo
        WHEN 'dono' THEN 1
        WHEN 'gerente' THEN 2
        WHEN 'profissional' THEN 3
        WHEN 'auxiliar' THEN 4
        WHEN 'aprendiz' THEN 5
        ELSE 6 END, f.nome ASC
''')
active_final = c.fetchall()

print(f"\n✓ TOTAL DE MEMBROS ATIVOS NO BANCO: {len(active_final)}")
for row in active_final:
    print(f"[{row[2].upper():<12}] {row[0]:<25} ({row[1]})")

