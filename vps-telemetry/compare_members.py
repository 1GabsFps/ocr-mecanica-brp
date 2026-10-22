import sqlite3, json, unicodedata

def normalize(text):
    if not text: return ""
    text = unicodedata.normalize('NFKD', text)
    text = "".join([c for c in text if not unicodedata.combining(c)])
    return " ".join(text.lower().strip().split())

user_list = [
    ("Gabriel Loret", "aprendiz"),
    ("Joao Santos", "gerente"),
    ("Stivao Stafio leal", "dono"),
    ("Vincent Montgomery", "gerente"),
    ("Adeilton Ferreira", "profissional"),
    ("Apolo Sanduba", "auxiliar"),
    ("Bruno Chipito", "aprendiz"),
    ("Carimbo Rostand", "profissional"),
    ("Carlos Daniel", "auxiliar"),
    ("Cidoka Sousa", "auxiliar"),
    ("Davasco Mottu", "profissional"),
    ("Dean Cooper", "auxiliar"),
    ("Eduardo Makarov", "profissional"),
    ("Fabio Henrique", "auxiliar"),
    ("Felipe Laurent", "profissional"),
    ("Gabriel Alexandre", "auxiliar"),
    ("Gabriel Martims", "profissional"),
    ("Gajeel Wingates", "profissional"),
    ("Iran De santana pedre", "profissional"),
    ("Jackson Wolf", "profissional"),
    ("Joao Vitor", "aprendiz"),
    ("João Carabina", "profissional"),
    ("João Green", "profissional"),
    ("Joao Makarov", "profissional"),
    ("Jobson Mayländer", "profissional"),
    ("John Dravelli", "auxiliar"),
    ("John Jones", "profissional"),
    ("Jonas Molina", "auxiliar"),
    ("Kristofh Postura", "profissional"),
    ("Livia Araujo", "gerente"),
    ("Marcos Portela", "auxiliar"),
    ("Matheus Leal", "profissional"),
    ("Natanzinho Lima", "profissional"),
    ("Nathalia Tempest", "auxiliar"),
    ("Paulinho Junior", "auxiliar"),
    ("Pe Alks", "aprendiz"),
    ("Renato Neves", "aprendiz"),
    ("Rogi Lael", "profissional"),
    ("Sadrac Beiramar", "auxiliar"),
    ("Scott Delacruz", "profissional"),
    ("Thomas Gucci", "auxiliar"),
    ("Tommy Raminhos", "auxiliar"),
    ("Tony Redgrave", "auxiliar"),
    ("Vei chibungo Oliveira", "profissional"),
    ("Veio Pobre", "profissional"),
    ("Ze Comeia", "dono")
]

conn = sqlite3.connect('/home/ubuntu/mec-telemetry/data/telemetry.db')
c = conn.cursor()

# Busca funcionários do banco
c.execute('''
    SELECT f.steam_hex, f.nome, COALESCE(r.cargo, 'auxiliar'), f.ativo
    FROM funcionarios f
    LEFT JOIN member_roles r ON LOWER(f.steam_hex) = LOWER(r.steam_hex)
''')
db_rows = c.fetchall()

db_dict = {}
for hex_id, nome, cargo, ativo in db_rows:
    norm_nome = normalize(nome)
    db_dict[norm_nome] = {
        "steam_hex": hex_id,
        "nome": nome,
        "cargo_db": cargo.lower(),
        "ativo": ativo
    }

print(f"Total de membros na lista informada: {len(user_list)}")
print(f"Total de membros cadastrados no banco: {len(db_rows)}\n")

divergencias_cargo = []
nao_encontrados_no_banco = []
corretos = []

for nome, cargo_esperado in user_list:
    norm = normalize(nome)
    # Tenta achar exato ou parcial
    match = db_dict.get(norm)
    if not match:
        for k, v in db_dict.items():
            if norm in k or k in norm:
                match = v
                break
    
    if not match:
        nao_encontrados_no_banco.append((nome, cargo_esperado))
    else:
        cargo_db = match['cargo_db']
        if cargo_db != cargo_esperado.lower():
            divergencias_cargo.append({
                "nome": match['nome'],
                "steam_hex": match['steam_hex'],
                "cargo_atual_no_banco": cargo_db,
                "cargo_correto": cargo_esperado
            })
        else:
            corretos.append((match['nome'], cargo_db))

print("=== 1. DIVERGÊNCIAS DE CARGO ===")
for d in divergencias_cargo:
    print(f"• {d['nome']} ({d['steam_hex']}): Banco={d['cargo_atual_no_banco'].upper()} -> Correto={d['cargo_correto'].upper()}")

print(f"\n=== 2. MEMBROS DA LISTA NÃO LOCALIZADOS NO BANCO ({len(nao_encontrados_no_banco)}) ===")
for nome, cargo in nao_encontrados_no_banco:
    print(f"• {nome} ({cargo.upper()})")

print(f"\n=== 3. MEMBROS COM CARGO 100% CORRETO ({len(corretos)}) ===")
for nome, cargo in corretos:
    print(f"✓ {nome} = {cargo.upper()}")

# Membros no banco que não estão na lista de 46 ativos
user_norm_set = set(normalize(n) for n, _ in user_list)
antigos_no_banco = []
for norm, d in db_dict.items():
    found = False
    for u_norm in user_norm_set:
        if u_norm in norm or norm in u_norm:
            found = True
            break
    if not found:
        antigos_no_banco.append((d['nome'], d['cargo_db'], d['steam_hex']))

print(f"\n=== 4. REGISTROS EXTRAS NO BANCO (NÃO LISTADOS NOS 46 ATUAIS): {len(antigos_no_banco)} ===")
for nome, cargo, hex_id in antigos_no_banco[:15]:
    print(f"• {nome} ({cargo.upper()}) - {hex_id}")
if len(antigos_no_banco) > 15:
    print(f"... e mais {len(antigos_no_banco) - 15} registros.")
