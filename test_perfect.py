import os, glob, re
from PIL import Image
from rapidocr_onnxruntime import RapidOCR
import numpy as np

engine = RapidOCR()

class PerfectFiveMOCR:
    HEADER_ALIASES = {
        'placa': ['placa', 'placo', 'plac', 'ploc', 'pla', 'registro', 'plate'],
        'proprietario': ['proprietario', 'proprietário', 'proprietorio', 'proprietóro', 'propriet', 'dono', 'cliente', 'nome', 'owner'],
        'carro': ['carro', 'car', 'veiculo', 'veículo', 'veic', 'veiculo', 'modelo', 'automovel', 'automóvel', 'caminhao', 'caminhão'],
        'cor': ['cor', 'cores', 'color', 'pintura'],
        'modificacoes': ['modificacoes', 'modificações', 'modificagdes', 'modificopoes', 'modific', 'servicos', 'serviços', 'servico', 'serviço', 'tuning'],
        'fipe': ['fipe', 'tabela', 'valor'],
        'ipva': ['ipva'],
        'multas': ['multas', 'multos', 'multa']
    }

    CORES = {
        'branco', 'preto', 'vermelho', 'azul', 'prata', 'cinza', 'amarelo', 'verde',
        'laranja', 'roxo', 'rosa', 'roza', 'dourado', 'marrom', 'vinho', 'bege', 'grafite',
        'fosco', 'verde-oliva', 'turquesa', 'ciano', 'magenta', 'gelo', 'perolizado'
    }

    @classmethod
    def clean_spaces_camel(cls, text: str) -> str:
        """Separa palavras coladas em camelCase (ex: 'RibaMar' -> 'Ribamar', 'AmarokCabine' -> 'Amarok Cabine', 'FH16780' -> 'FH16 780')."""
        if not text:
            return ""
        # Letra minúscula seguida de maiúscula
        t = re.sub(r'([a-z0-9])([A-Z])', r'\1 \2', text)
        # Letras seguidas de números ou números seguidos de letras (exceto placa)
        t = re.sub(r'([A-Za-z]{2,})(\d{2,})', r'\1 \2', t)
        return re.sub(r'\s+', ' ', t).strip()

    @classmethod
    def format_plate(cls, text: str) -> str:
        if not text:
            return "[Não identificado]"
        clean = re.sub(r'[^A-Za-z0-9]', '', text).upper()
        # Placa antiga padrão: ABC1234 -> ABC 1234
        m_old = re.match(r'^([A-Z]{3})(\d{4})$', clean)
        if m_old:
            return f"{m_old.group(1)} {m_old.group(2)}"
        # Placa Mercosul padrão: ABC1D23 -> ABC 1D23 ou ABC1D23
        m_merco = re.match(r'^([A-Z]{3})(\d[A-Z]\d{2})$', clean)
        if m_merco:
            return f"{m_merco.group(1)} {m_merco.group(2)}"
        # Placa com 2 a 4 letras
        m_other = re.match(r'^([A-Z]{2,4})(\d[A-Z0-9]{1,4})$', clean)
        if m_other:
            return f"{m_other.group(1)} {m_other.group(2)}"
        return clean if len(clean) >= 4 else text.strip().upper()

    @classmethod
    def format_owner(cls, text: str) -> str:
        if not text or text == "[Não identificado]":
            return "[Não identificado]"
        cleaned = cls.clean_spaces_camel(text)
        words = [w.capitalize() for w in cleaned.split() if w.lower() not in cls.CORES and not re.match(r'^(r?\$?\d+|rs\d*)$', w.lower())]
        return " ".join(words) if words else "[Não identificado]"

    @classmethod
    def format_model(cls, text: str) -> str:
        if not text or text == "[Não identificado]":
            return "[Não identificado]"
        cleaned = cls.clean_spaces_camel(text)
        words = [w for w in cleaned.split() if w.lower() not in cls.CORES and not re.match(r'^(r?\$?\d+|rs\d*)$', w.lower())]
        res = " ".join(words)
        # Formatar modelos conhecidos (ex: FH16 780, Amarok Cabine Simples)
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

        # 3. Detectar Cabeçalhos da Tabela
        detected_headers = {}
        header_boxes = []
        for b in all_boxes:
            t_norm = re.sub(r'[^a-zA-ZáéíóúÁÉÍÓÚãõÃÕâêîôûÂÊÎÔÛçÇ]', '', b['text'].lower())
            for col_key, aliases in cls.HEADER_ALIASES.items():
                if col_key not in detected_headers and any(alias == t_norm or alias in t_norm for alias in aliases):
                    detected_headers[col_key] = b
                    header_boxes.append(b)
                    break

        # Se encontrou cabeçalhos de tabela
        if len(detected_headers) >= 2 and ('placa' in detected_headers or 'proprietario' in detected_headers or 'carro' in detected_headers):
            h_ymin = min(b['ymin'] for b in header_boxes)
            h_ymax = max(b['ymax'] for b in header_boxes)
            h_height = max(12, h_ymax - h_ymin)

            # Limites horizontais da tabela
            table_xmin = min(b['xmin'] for b in header_boxes) - int(h_height * 1.5)
            table_xmax = max(b['xmax'] for b in header_boxes) + int(h_height * 2.0)

            # Linha de dados: logo abaixo do cabeçalho
            data_ymin_min = h_ymax - 2
            data_ymin_max = h_ymax + int(h_height * 2.2)

            data_row_boxes = [
                b for b in all_boxes
                if b not in header_boxes
                and table_xmin <= b['xmin'] and b['xmax'] <= table_xmax + 50
                and data_ymin_min <= b['ymin'] <= data_ymin_max
            ]

            # Ordenar as colunas detectadas por X
            sorted_cols = sorted(detected_headers.items(), key=lambda item: item[1]['xmin'])

            # Construir os centros e limites de cada coluna
            col_centers = []
            for i, (col_key, h_box) in enumerate(sorted_cols):
                cx = (h_box['xmin'] + h_box['xmax']) / 2.0
                col_centers.append((col_key, cx, h_box))

            # Para cada palavra/fragmento dentro dos data_row_boxes, projetar na coluna mais próxima
            col_words = {k: [] for k in detected_headers}

            for db in data_row_boxes:
                text = db['text']
                # Se o texto tem palavras grudadas em camelCase, separar mantendo posições
                # Quebrar em palavras individuais
                words = text.split()
                if len(words) == 1:
                    # Tentar ver se tem camelCase como 'FerrariFH16' ou 'Bruno FerrariFH16'
                    camel_split = re.findall(r'[A-Z][a-z0-9]*|[0-9]+|[a-z]+', text)
                    if len(camel_split) > 1:
                        words = camel_split

                # Distribuir as palavras ao longo do span do box
                box_w = max(1, db['xmax'] - db['xmin'])
                total_w_chars = max(1, sum(len(w) for w in words))
                
                curr_char = 0
                for w in words:
                    w_center_ratio = (curr_char + len(w)/2.0) / total_w_chars
                    w_x = db['xmin'] + w_center_ratio * box_w
                    curr_char += len(w)

                    # Achar a coluna cujo centro é mais próximo deste x
                    best_col = min(col_centers, key=lambda c: abs(c[1] - w_x))[0]
                    col_words[best_col].append(w)

            # Atribuir resultados formatados
            if 'placa' in col_words and col_words['placa']:
                info['placa'] = cls.format_plate(" ".join(col_words['placa']))

            if 'proprietario' in col_words and col_words['proprietario']:
                info['proprietario'] = cls.format_owner(" ".join(col_words['proprietario']))

            if 'carro' in col_words and col_words['carro']:
                info['modelo'] = cls.format_model(" ".join(col_words['carro']))

        # Fallback se a placa não foi detectada
        if info['placa'] == "[Não identificado]":
            p_match = re.search(r'\b([A-Z]{3}\s*[0-9][A-Z0-9]{3})\b', raw_text, re.IGNORECASE)
            if not p_match:
                p_match = re.search(r'\b([A-Z]{2,4}\s*[0-9]{3,4})\b', raw_text, re.IGNORECASE)
            if p_match:
                info['placa'] = cls.format_plate(p_match.group(1))

        return info, raw_text

# Executar nos 5 arquivos
img_paths = glob.glob(r'C:\Users\gabri\.gemini\antigravity\brain\aa424464-2199-4081-88f6-392e9a599ca5\.user_uploaded\*.*')
for p in img_paths:
    print("="*60)
    print("FILE:", os.path.basename(p))
    img = Image.open(p)
    info, raw = PerfectFiveMOCR.extract_info(img)
    print("EXTRACTED INFO:", info)
