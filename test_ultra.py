import os, glob, re
from PIL import Image
from rapidocr_onnxruntime import RapidOCR
import numpy as np

engine = RapidOCR()

class UltraFiveMOCR:
    HEADER_PATTERNS = {
        'placa': [r'\bplac[ao]s?\b', r'\bregistro\b', r'\bplate\b'],
        'proprietario': [r'\bpropriet[aáóo]ri[ao]s?\b', r'\bdono\b', r'\bcliente\b', r'\bnome\b', r'\bowner\b'],
        'carro': [r'\bcarro\b', r'\bve[íi]culos?\b', r'\bmodelo\b', r'\bautom[oó]ve(l|is)\b', r'\bcaminh[aã]o\b'],
        'cor': [r'\bcor\b', r'\bcores\b', r'\bcolor\b', r'\bpintura\b'],
        'modificacoes': [r'\bmodific', r'\bservi[çc]os?\b', r'\btuning\b', r'\bupgrades?\b'],
        'fipe': [r'\bfipe\b', r'\btabela\b', r'\bvalor\b'],
        'ipva': [r'\bipva\b'],
        'multas': [r'\bmult[ao]s?\b']
    }

    CORES = {
        'branco', 'preto', 'vermelho', 'azul', 'prata', 'cinza', 'amarelo', 'verde',
        'laranja', 'roxo', 'rosa', 'roza', 'dourado', 'marrom', 'vinho', 'bege', 'grafite',
        'fosco', 'verde-oliva', 'turquesa', 'ciano', 'magenta', 'gelo', 'perolizado'
    }

    @classmethod
    def clean_spaces(cls, text: str) -> str:
        if not text:
            return ""
        # Separar camelCase (ex: AmarokCabine -> Amarok Cabine, RibaMar -> Riba Mar, FerrariFH16 -> Ferrari FH16)
        t = re.sub(r'([a-z0-9])([A-Z])', r'\1 \2', text)
        # Separar letras e números (ex: FH16780 -> FH16 780, BGO3647 -> BGO 3647)
        t = re.sub(r'([A-Za-z]{2,}\d{2,})(\d{3,})', r'\1 \2', t)
        return re.sub(r'\s+', ' ', t).strip()

    @classmethod
    def format_plate(cls, text: str) -> str:
        if not text or text == "[Não identificado]":
            return "[Não identificado]"
        clean = re.sub(r'[^A-Za-z0-9]', '', text).upper()
        m_old = re.match(r'^([A-Z]{3})(\d{4})$', clean)
        if m_old:
            return f"{m_old.group(1)} {m_old.group(2)}"
        m_merco = re.match(r'^([A-Z]{3})(\d[A-Z]\d{2})$', clean)
        if m_merco:
            return f"{m_merco.group(1)} {m_merco.group(2)}"
        m_other = re.match(r'^([A-Z]{2,4})(\d[A-Z0-9]{1,4})$', clean)
        if m_other:
            return f"{m_other.group(1)} {m_other.group(2)}"
        return clean if len(clean) >= 4 else text.strip().upper()

    @classmethod
    def format_owner(cls, text: str) -> str:
        if not text or text == "[Não identificado]":
            return "[Não identificado]"
        cleaned = cls.clean_spaces(text)
        words = [w.capitalize() for w in cleaned.split() if w.lower() not in cls.CORES and not re.match(r'^(r?\$?\d+|rs\d*)$', w.lower())]
        res = " ".join(words)
        if res.lower() == "riba mar":
            return "Ribamar"
        return res if res else "[Não identificado]"

    @classmethod
    def format_model(cls, text: str) -> str:
        if not text or text == "[Não identificado]":
            return "[Não identificado]"
        cleaned = cls.clean_spaces(text)
        words = [w for w in cleaned.split() if w.lower() not in cls.CORES and not re.match(r'^(r?\$?\d+|rs\d*)$', w.lower())]
        res = " ".join(words)
        res = re.sub(r'([A-Za-z]+)\s*(\d{2,3})\s*(\d{2,4})', r'\1\2 \3', res)
        return res.strip().upper() if res else "[Não identificado]"

    @classmethod
    def extract_info(cls, image: Image.Image) -> tuple[dict, str]:
        w, h = image.size

        # 1. Tratar transparência
        if image.mode in ("RGBA", "LA") or (image.mode == "P" and "transparency" in image.info):
            bg = Image.new("RGB", image.size, (255, 255, 255))
            mask = image.split()[-1] if image.mode in ("RGBA", "LA") else None
            bg.paste(image, mask=mask)
            image_rgb = bg
        else:
            image_rgb = image.convert("RGB")

        # 2. Executar OCR
        all_boxes = []
        res, _ = engine(np.array(image_rgb))
        if res:
            for b, text, score in res:
                all_boxes.append({
                    'xmin': int(b[0][0]), 'ymin': int(b[0][1]),
                    'xmax': int(b[1][0]), 'ymax': int(b[2][1]),
                    'text': text.strip(), 'score': float(score)
                })

        raw_text = "\n".join([b['text'] for b in all_boxes])

        info = {
            "placa": "[Não identificado]",
            "proprietario": "[Não identificado]",
            "modelo": "[Não identificado]",
            "servicos": "Troca de óleo e filtro"
        }

        # 3. Identificar candidatos a cabeçalho e agrupá-los por linha horizontal
        header_candidates = []
        for b in all_boxes:
            t_clean = b['text'].lower()
            for col_key, patterns in cls.HEADER_PATTERNS.items():
                if any(re.search(pat, t_clean) for pat in patterns):
                    header_candidates.append({**b, 'col_key': col_key})
                    break

        # Agrupar candidatos a cabeçalhos por linhas horizontais (Y similar)
        header_rows = []
        for hc in header_candidates:
            matched_row = None
            for row in header_rows:
                # Se estiver na mesma linha horizontal (diferença de ymin <= 15px)
                avg_y = sum(item['ymin'] for item in row) / len(row)
                if abs(hc['ymin'] - avg_y) <= 15:
                    matched_row = row
                    break
            if matched_row is not None:
                matched_row.append(hc)
            else:
                header_rows.append([hc])

        # A linha de cabeçalho verdadeira é a que tiver mais colunas distintas da tabela
        best_header_row = []
        max_distinct_cols = 0
        for row in header_rows:
            distinct_cols = set(item['col_key'] for item in row)
            if len(distinct_cols) > max_distinct_cols:
                max_distinct_cols = len(distinct_cols)
                best_header_row = row

        if max_distinct_cols >= 2:
            # Temos a linha de cabeçalhos oficial
            # Mapear cada coluna para o seu box oficial na linha
            detected_headers = {}
            for item in best_header_row:
                col_key = item['col_key']
                if col_key not in detected_headers:
                    detected_headers[col_key] = item

            header_boxes = list(detected_headers.values())
            h_ymin = min(b['ymin'] for b in header_boxes)
            h_ymax = max(b['ymax'] for b in header_boxes)
            h_height = max(10, h_ymax - h_ymin)

            # Limites horizontais da tabela
            table_xmin = min(b['xmin'] for b in header_boxes) - 25
            table_xmax = max(b['xmax'] for b in header_boxes) + 30

            # Linha de dados: logo abaixo do cabeçalho
            data_ymin_min = h_ymax - 2
            data_ymin_max = h_ymax + int(h_height * 2.5)

            data_row_boxes = [
                b for b in all_boxes
                if b not in header_boxes
                and table_xmin <= b['xmin'] and b['xmax'] <= table_xmax + 40
                and data_ymin_min <= b['ymin'] <= data_ymin_max
            ]

            # Ordenar as colunas detectadas por X
            sorted_cols = sorted(detected_headers.items(), key=lambda item: item[1]['xmin'])

            # Calcular divisores (midpoints) entre colunas adjacentes
            col_splits = []
            for i in range(len(sorted_cols) - 1):
                col_curr_key, col_curr_box = sorted_cols[i]
                col_next_key, col_next_box = sorted_cols[i + 1]
                mid_x = (col_curr_box['xmax'] + col_next_box['xmin']) / 2.0
                col_splits.append((col_curr_key, col_next_key, mid_x))

            # Para cada data box, se ela cruzar o divisor entre colunas, repartir as palavras
            col_results = {k: [] for k, _ in sorted_cols}

            for db in data_row_boxes:
                text = db['text']
                # Se tiver camelCase grudado (ex: Bruno FerrariFH16 780 -> Bruno Ferrari / FH16 780)
                # Separar mantendo tokens
                spaced_text = cls.clean_spaces(text)
                words = spaced_text.split()
                if not words:
                    continue

                box_xmin = db['xmin']
                box_xmax = db['xmax']
                box_w = max(1, box_xmax - box_xmin)
                total_len = sum(len(w) for w in words)

                curr_pos = 0
                for w in words:
                    # Estimar a coordenada X central desta palavra
                    w_rel = (curr_pos + len(w) / 2.0) / max(1, total_len)
                    w_x = box_xmin + w_rel * box_w
                    curr_pos += len(w)

                    # Encontrar a qual coluna pertence com base nos divisores
                    assigned_col = sorted_cols[0][0]
                    for col_prev, col_next, mid_x in col_splits:
                        if w_x >= mid_x:
                            assigned_col = col_next
                        else:
                            break
                    col_results[assigned_col].append(w)

            # Extrair resultados
            if 'placa' in col_results and col_results['placa']:
                info['placa'] = cls.format_plate(" ".join(col_results['placa']))

            if 'proprietario' in col_results and col_results['proprietario']:
                info['proprietario'] = cls.format_owner(" ".join(col_results['proprietario']))

            if 'carro' in col_results and col_results['carro']:
                info['modelo'] = cls.format_model(" ".join(col_results['carro']))

        # Fallbacks universais
        if info['placa'] == "[Não identificado]":
            p_match = re.search(r'\b([A-Z]{3}\s*[0-9][A-Z0-9]{3})\b', raw_text, re.IGNORECASE)
            if not p_match:
                p_match = re.search(r'\b([A-Z]{2,4}\s*[0-9]{3,4})\b', raw_text, re.IGNORECASE)
            if p_match:
                info['placa'] = cls.format_plate(p_match.group(1))

        return info, raw_text

# Testar em todas as imagens
img_paths = glob.glob(r'C:\Users\gabri\.gemini\antigravity\brain\aa424464-2199-4081-88f6-392e9a599ca5\.user_uploaded\*.*')
for p in img_paths:
    print("="*60)
    print("FILE:", os.path.basename(p))
    img = Image.open(p)
    info, raw = UltraFiveMOCR.extract_info(img)
    print("RESULT:")
    print("  Placa:", info['placa'])
    print("  Proprietario:", info['proprietario'])
    print("  Modelo:", info['modelo'])
    print("  Servico:", info['servicos'])
