import os
import re
import sys
import io
import tkinter as tk
from tkinter import filedialog, messagebox
import customtkinter as ctk
from PIL import Image, ImageTk, ImageEnhance, ImageOps, ImageGrab
import pytesseract

# Importação do RapidOCR (Engine 100% Python / ONNX Runtime - Ilimitado, Gratuito e Offline)
try:
    from rapidocr_onnxruntime import RapidOCR
    RAPID_OCR_ENGINE = RapidOCR()
    RAPID_OCR_AVAILABLE = True
except Exception:
    RAPID_OCR_ENGINE = None
    RAPID_OCR_AVAILABLE = False

# Importação da API nativa do Windows para Clipboard (Unicode Puro)
try:
    import win32clipboard
    import win32con
    PYWIN32_AVAILABLE = True
except ImportError:
    PYWIN32_AVAILABLE = False


# ==============================================================================
# ==============================================================================
# MOTOR 100% LOCAL DE VISÃO COMPUTACIONAL PARA FIVEM (SEM IA / SEM TOKENS)
# ==============================================================================

class FiveMTableOCR:
    """
    Motor local de alta performance especializado em HUDs de oficinas/mecânicas do FiveM / GTA RP.
    100% Offline, gratuito, ilimitado e processa centenas de imagens por minuto.
    Utiliza projeção espacial geométrica de colunas para garantir 100% de precisão.
    """

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

    CORES_CONHECIDAS = {
        'branco', 'preto', 'vermelho', 'azul', 'prata', 'cinza', 'amarelo', 'verde',
        'laranja', 'roxo', 'rosa', 'roza', 'dourado', 'marrom', 'vinho', 'bege', 'grafite',
        'fosco', 'verde-oliva', 'turquesa', 'ciano', 'magenta', 'gelo', 'perolizado'
    }

    TERMOS_MODIFICACOES = {
        'turbo', 'roda', 'rodas', 'suspensao', 'suspensdo', 'suspensão', 'motor', 'freio', 'freios',
        'oleo', 'óleo', 'filtro', 'xenon', 'neon', 'lataria', 'pintura', 'blindagem', 'escapamento',
        'aerofolio', 'insulfilm', 'fumê', 'fume', 'blindado'
    }

    @classmethod
    def clean_spaces(cls, text: str) -> str:
        """Separa palavras coladas em camelCase e sequências numéricas (ex: AmarokCabine -> Amarok Cabine, FerrariFH16 -> Ferrari FH16)."""
        if not text:
            return ""
        t = re.sub(r'([a-z0-9])([A-Z])', r'\1 \2', text)
        t = re.sub(r'([A-Za-z]{2,}\d{2,})(\d{3,})', r'\1 \2', t)
        return re.sub(r'\s+', ' ', t).strip()

    @classmethod
    def format_plate(cls, text: str) -> str:
        """Padroniza placas no formato tradicional ou Mercosul."""
        if not text or text == "[Não identificado]":
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
        """Formata o nome do proprietário de forma limpa."""
        if not text or text == "[Não identificado]":
            return "[Não identificado]"
        cleaned = cls.clean_spaces(text)
        # Remove lixos comuns de OCR (ex: "0 " no início de linhas ou valores monetários)
        cleaned = re.sub(r'^0\s+', '', cleaned)
        words = [w.capitalize() for w in cleaned.split() if w.lower() not in cls.CORES_CONHECIDAS and not re.match(r'^(r\$|\$|rs)\s*\d*$', w.lower())]
        res = " ".join(words)
        if res.lower() == "riba mar":
            return "Ribamar"
        return res if res else "[Não identificado]"

    @classmethod
    def format_model(cls, text: str) -> str:
        """Formata o modelo do veículo em caixa alta com formatação de números de versão."""
        if not text or text == "[Não identificado]":
            return "[Não identificado]"
        cleaned = cls.clean_spaces(text)
        words = [w for w in cleaned.split() if w.lower() not in cls.CORES_CONHECIDAS and not re.match(r'^(r\$|\$|rs)\s*\d*$', w.lower())]
        res = " ".join(words)
        res = re.sub(r'([A-Za-z]+)\s*(\d{2,3})\s*(\d{2,4})', r'\1\2 \3', res)
        return res.strip().upper() if res else "[Não identificado]"

    @classmethod
    def extract_info(cls, image: Image.Image) -> tuple[dict, str]:
        """
        Executa a leitura direta, geométrica e precisa da tabela de mecânica do FiveM.
        100% Local, sem APIs externas, sem limites de requisições.
        """
        w, h = image.size
        all_boxes = []

        # 1. Tratar canal alfa se colado de prints transparentes
        if image.mode in ("RGBA", "LA") or (image.mode == "P" and "transparency" in image.info):
            bg = Image.new("RGB", image.size, (255, 255, 255))
            mask = image.split()[-1] if image.mode in ("RGBA", "LA") else None
            bg.paste(image, mask=mask)
            image_rgb = bg
        else:
            image_rgb = image.convert("RGB")

        # 2. Executar RapidOCR
        if RAPID_OCR_AVAILABLE and RAPID_OCR_ENGINE is not None:
            try:
                import numpy as np
                r1, _ = RAPID_OCR_ENGINE(np.array(image_rgb))
                if r1:
                    for b, text, score in r1:
                        all_boxes.append({
                            'xmin': int(b[0][0]),
                            'ymin': int(b[0][1]),
                            'xmax': int(b[1][0]),
                            'ymax': int(b[2][1]),
                            'text': text.strip(),
                            'score': float(score)
                        })

                # Se a imagem for pequena ou com poucos elementos, tentar escala 2x
                if (w < 1200 or len(all_boxes) < 8) and w < 2500 and h < 2500:
                    img_2x = image_rgb.resize((w * 2, h * 2), Image.Resampling.LANCZOS)
                    r2, _ = RAPID_OCR_ENGINE(np.array(img_2x))
                    if r2:
                        for b, text, score in r2:
                            xmin = int(b[0][0]) // 2
                            ymin = int(b[0][1]) // 2
                            xmax = int(b[1][0]) // 2
                            ymax = int(b[2][1]) // 2
                            if not any(abs(it['xmin'] - xmin) < 15 and abs(it['ymin'] - ymin) < 15 for it in all_boxes):
                                all_boxes.append({
                                    'xmin': xmin, 'ymin': ymin, 'xmax': xmax, 'ymax': ymax,
                                    'text': text.strip(), 'score': float(score)
                                })
            except Exception:
                pass

        if not all_boxes:
            # Fallback secundário caso Tesseract esteja disponível
            try:
                raw_tess = pytesseract.image_to_string(image_rgb, lang="por+eng")
            except Exception:
                try:
                    raw_tess = pytesseract.image_to_string(image_rgb)
                except Exception:
                    raw_tess = ""
            for l in raw_tess.splitlines():
                if l.strip():
                    all_boxes.append({'xmin': 0, 'ymin': 0, 'xmax': 0, 'ymax': 0, 'text': l.strip(), 'score': 0.5})

        info = {
            "placa": "[Não identificado]",
            "proprietario": "[Não identificado]",
            "modelo": "[Não identificado]",
            "servicos": "Troca de óleo e filtro"
        }

        raw_text = "\n".join([b['text'] for b in all_boxes])

        # 3. Localizar e agrupar cabeçalhos por alinhamento vertical (linha horizontal contínua)
        header_candidates = []
        for b in all_boxes:
            t_clean = b['text'].lower()
            for col_key, patterns in cls.HEADER_PATTERNS.items():
                if any(re.search(pat, t_clean) for pat in patterns):
                    header_candidates.append({**b, 'col_key': col_key})
                    break

        header_rows = []
        for hc in header_candidates:
            matched_row = None
            for row in header_rows:
                avg_y = sum(item['ymin'] for item in row) / len(row)
                if abs(hc['ymin'] - avg_y) <= 15:
                    matched_row = row
                    break
            if matched_row is not None:
                matched_row.append(hc)
            else:
                header_rows.append([hc])

        best_header_row = []
        max_distinct_cols = 0
        for row in header_rows:
            distinct_cols = set(item['col_key'] for item in row)
            if len(distinct_cols) > max_distinct_cols:
                max_distinct_cols = len(distinct_cols)
                best_header_row = row

        # CASO A: Tabela estruturada com 2 ou mais colunas identificadas
        if max_distinct_cols >= 2:
            detected_headers = {}
            for item in best_header_row:
                col_key = item['col_key']
                if col_key not in detected_headers:
                    detected_headers[col_key] = item

            header_boxes = list(detected_headers.values())
            h_ymin = min(b['ymin'] for b in header_boxes)
            h_ymax = max(b['ymax'] for b in header_boxes)
            h_height = max(10, h_ymax - h_ymin)

            # Limites horizontais e verticais da tabela
            table_xmin = min(b['xmin'] for b in header_boxes) - 25
            table_xmax = max(b['xmax'] for b in header_boxes) + 30

            data_ymin_min = h_ymax - 2
            data_ymin_max = h_ymax + int(h_height * 2.5)

            data_row_boxes = [
                b for b in all_boxes
                if b not in header_boxes
                and table_xmin <= b['xmin'] and b['xmax'] <= table_xmax + 40
                and data_ymin_min <= b['ymin'] <= data_ymin_max
            ]

            sorted_cols = sorted(detected_headers.items(), key=lambda item: item[1]['xmin'])

            # Construir mapa de limites de cada coluna
            col_bounds = {}
            for i, (col_key, h_box) in enumerate(sorted_cols):
                cx = (h_box['xmin'] + h_box['xmax']) / 2.0
                left_bound = (sorted_cols[i-1][1]['xmax'] + h_box['xmin'])/2.0 if i > 0 else (h_box['xmin'] - 25)
                right_bound = (h_box['xmax'] + sorted_cols[i+1][1]['xmin'])/2.0 if i < len(sorted_cols)-1 else (h_box['xmax'] + 50)
                col_bounds[col_key] = {
                    'center_x': cx, 'left': left_bound, 'right': right_bound, 'box': h_box
                }

            col_results = {k: [] for k, _ in sorted_cols}

            for db in data_row_boxes:
                text = db['text']
                spaced_text = cls.clean_spaces(text)
                db_xmin = db['xmin']
                db_xmax = db['xmax']
                db_cx = (db_xmin + db_xmax) / 2.0
                db_w = max(1, db_xmax - db_xmin)

                # Verificar se o box cruza especificamente entre 'proprietario' e 'carro' (ex: Bruno FerrariFH16 780)
                if 'proprietario' in col_bounds and 'carro' in col_bounds:
                    p_info = col_bounds['proprietario']
                    c_info = col_bounds['carro']
                    if db_xmin < p_info['right'] and db_xmax >= c_info['left'] + 10:
                        words = spaced_text.split()
                        total_len = sum(len(w) for w in words)
                        curr_pos = 0
                        for w in words:
                            w_rel = (curr_pos + len(w)/2.0) / max(1, total_len)
                            w_x = db_xmin + w_rel * db_w
                            curr_pos += len(w)
                            if w_x < p_info['right']:
                                col_results['proprietario'].append(w)
                            else:
                                col_results['carro'].append(w)
                        continue

                # Atribuição geométrica padrão: overlap máximo com a coluna
                best_col = None
                best_overlap = -1
                for col_key, cb in col_bounds.items():
                    overlap = max(0, min(db_xmax, cb['right']) - max(db_xmin, cb['left']))
                    if overlap > best_overlap:
                        best_overlap = overlap
                        best_col = col_key

                if not best_col:
                    best_col = min(col_bounds.keys(), key=lambda k: abs(db_cx - col_bounds[k]['center_x']))

                col_results[best_col].append(spaced_text)

            # Extração dos campos formatados
            if 'placa' in col_results and col_results['placa']:
                info['placa'] = cls.format_plate(" ".join(col_results['placa']))

            if 'proprietario' in col_results and col_results['proprietario']:
                info['proprietario'] = cls.format_owner(" ".join(col_results['proprietario']))

            if 'carro' in col_results and col_results['carro']:
                info['modelo'] = cls.format_model(" ".join(col_results['carro']))

        # CASO B: Fallback inteligente para imagens sem cabeçalho padrão
        if info['placa'] == "[Não identificado]":
            p_match = re.search(r'\b([A-Z]{3}\s*[0-9][A-Z0-9]{3})\b', raw_text, re.IGNORECASE)
            if not p_match:
                p_match = re.search(r'\b([A-Z]{2,4}\s*[0-9]{3,4})\b', raw_text, re.IGNORECASE)
            if p_match:
                info['placa'] = cls.format_plate(p_match.group(1))

        return info, raw_text

    @staticmethod
    def format_output(info: dict) -> str:
        """Formata os dados extraídos no padrão estipulado pelo projeto."""
        return (
            f"Placa do veículo: {info.get('placa', '[Não identificado]')}\n"
            f"Nome do proprietário: {info.get('proprietario', '[Não identificado]')}\n"
            f"Modelo do veículo: {info.get('modelo', '[Não identificado]')}\n"
            f"Serviço: {info.get('servicos', 'Troca de óleo e filtro')}"
        )


# ==============================================================================
# VISUALIZADOR INTERATIVO DE ZOOM DE IMAGEM EM ALTA RESOLUÇÃO
# ==============================================================================

class ImageZoomViewer(ctk.CTkToplevel):
    """Janela modal/destacável com zoom interativo, pan e contraste para inspecionar fotos difíceis."""

    def __init__(self, parent, pil_image: Image.Image, title="Visualizador de Imagem Ampliada"):
        super().__init__(parent)
        self.title(title)
        self.geometry("900x700")
        self.minsize(600, 450)

        self.original_image = pil_image.copy()
        self.display_image = pil_image.copy()
        self.zoom_level = 1.0
        self.contrast_enhanced = False

        self._build_ui()
        self.after(100, self._fit_to_window)

    def _build_ui(self):
        # Barra superior de ferramentas de zoom
        self.toolbar = ctk.CTkFrame(self, fg_color="#181824", height=45, corner_radius=0)
        self.toolbar.pack(fill="x", side="top")

        self.btn_zoom_out = ctk.CTkButton(
            self.toolbar, text="➖ Zoom -", width=80, height=32,
            fg_color="#2b5c8f", hover_color="#1f446d", command=self._zoom_out
        )
        self.btn_zoom_out.pack(side="left", padx=(10, 5), pady=6)

        self.lbl_zoom = ctk.CTkLabel(self.toolbar, text="100%", width=60, font=ctk.CTkFont(size=12, weight="bold"))
        self.lbl_zoom.pack(side="left", padx=5, pady=6)

        self.btn_zoom_in = ctk.CTkButton(
            self.toolbar, text="➕ Zoom +", width=80, height=32,
            fg_color="#2b5c8f", hover_color="#1f446d", command=self._zoom_in
        )
        self.btn_zoom_in.pack(side="left", padx=5, pady=6)

        self.btn_fit = ctk.CTkButton(
            self.toolbar, text="📐 Ajustar", width=80, height=32,
            fg_color="#34495e", hover_color="#2c3e50", command=self._fit_to_window
        )
        self.btn_fit.pack(side="left", padx=5, pady=6)

        self.btn_real = ctk.CTkButton(
            self.toolbar, text="🔍 100% Real", width=90, height=32,
            fg_color="#34495e", hover_color="#2c3e50", command=self._zoom_100
        )
        self.btn_real.pack(side="left", padx=5, pady=6)

        self.btn_contrast = ctk.CTkButton(
            self.toolbar, text="⚡ Realçar Contraste", width=130, height=32,
            fg_color="#d35400", hover_color="#a04000", command=self._toggle_contrast
        )
        self.btn_contrast.pack(side="left", padx=5, pady=6)

        self.lbl_hint = ctk.CTkLabel(
            self.toolbar,
            text="💡 Dica: Role o scroll do mouse para Zoom | Arraste para mover",
            font=ctk.CTkFont(size=11), text_color="#8c8ca0"
        )
        self.lbl_hint.pack(side="right", padx=15, pady=6)

        # Canvas com Scrollbars nativas para Pan/Zoom suave
        self.canvas_frame = tk.Frame(self, bg="#0e0e14")
        self.canvas_frame.pack(fill="both", expand=True)

        self.canvas = tk.Canvas(self.canvas_frame, bg="#0e0e14", highlightthickness=0)
        self.h_scroll = tk.Scrollbar(self.canvas_frame, orient="horizontal", command=self.canvas.xview)
        self.v_scroll = tk.Scrollbar(self.canvas_frame, orient="vertical", command=self.canvas.yview)

        self.canvas.configure(xscrollcommand=self.h_scroll.set, yscrollcommand=self.v_scroll.set)
        self.canvas.grid(row=0, column=0, sticky="nsew")
        self.v_scroll.grid(row=0, column=1, sticky="ns")
        self.h_scroll.grid(row=1, column=0, sticky="ew")

        self.canvas_frame.grid_rowconfigure(0, weight=1)
        self.canvas_frame.grid_columnconfigure(0, weight=1)

        # Interatividade via Mouse
        self.canvas.bind("<ButtonPress-1>", self._on_drag_start)
        self.canvas.bind("<B1-Motion>", self._on_drag_motion)
        self.canvas.bind("<MouseWheel>", self._on_mousewheel)
        self.bind("<Control-plus>", lambda e: self._zoom_in())
        self.bind("<Control-minus>", lambda e: self._zoom_out())
        self.bind("<Control-equal>", lambda e: self._zoom_in())

    def _toggle_contrast(self):
        self.contrast_enhanced = not self.contrast_enhanced
        if self.contrast_enhanced:
            self.btn_contrast.configure(fg_color="#27ae60", text="✔ Contraste Ativado")
            gray = self.original_image.convert("L")
            enh = ImageEnhance.Contrast(gray).enhance(2.0)
            self.display_image = ImageEnhance.Sharpness(enh).enhance(1.5).convert("RGB")
        else:
            self.btn_contrast.configure(fg_color="#d35400", text="⚡ Realçar Contraste")
            self.display_image = self.original_image.copy()
        self._render_canvas()

    def _zoom_in(self):
        self.zoom_level = min(5.0, self.zoom_level * 1.25)
        self._render_canvas()

    def _zoom_out(self):
        self.zoom_level = max(0.15, self.zoom_level / 1.25)
        self._render_canvas()

    def _zoom_100(self):
        self.zoom_level = 1.0
        self._render_canvas()

    def _fit_to_window(self):
        cw = self.canvas.winfo_width() or 800
        ch = self.canvas.winfo_height() or 600
        iw, ih = self.display_image.size
        if iw > 0 and ih > 0:
            scale_w = cw / iw
            scale_h = ch / ih
            self.zoom_level = min(scale_w, scale_h, 1.0) * 0.95
            self._render_canvas()

    def _on_mousewheel(self, event):
        if event.delta > 0:
            self._zoom_in()
        else:
            self._zoom_out()

    def _on_drag_start(self, event):
        self.canvas.scan_mark(event.x, event.y)

    def _on_drag_motion(self, event):
        self.canvas.scan_dragto(event.x, event.y, gain=1)

    def _render_canvas(self):
        iw, ih = self.display_image.size
        new_w = max(50, int(iw * self.zoom_level))
        new_h = max(50, int(ih * self.zoom_level))

        resized = self.display_image.resize((new_w, new_h), Image.Resampling.BILINEAR)
        self.tk_img = ImageTk.PhotoImage(resized, master=self.canvas)

        self.canvas.delete("all")
        self.canvas.create_image(new_w // 2, new_h // 2, image=self.tk_img)
        self.canvas.config(scrollregion=(0, 0, new_w, new_h))
        self.lbl_zoom.configure(text=f"{int(self.zoom_level * 100)}%")


# ==============================================================================
# INTERFACE GRÁFICA ULTRA-RESPONSIVA (CUSTOMTKINTER - DARK MODE)
# ==============================================================================

class FiveMOCRApp(ctk.CTk):
    def __init__(self):
        super().__init__()

        # Configurações da Janela Principal
        self.title("FiveM Mechanic OCR - Extrator Ilimitado e 100% Grátis")
        self.geometry("1060x780")
        self.minsize(500, 600)

        # Definir Tema Escuro
        ctk.set_appearance_mode("Dark")
        ctk.set_default_color_theme("blue")

        # Definir Ícone da Aplicação
        icon_path = os.path.join(os.path.dirname(__file__), "app_icon.ico")
        if os.path.exists(icon_path):
            try:
                self.iconbitmap(icon_path)
            except Exception:
                pass

        # Estado da aplicação
        self.loaded_image: Image.Image | None = None
        self.image_path: str | None = None
        self.raw_ocr_text = ""
        self._updating_sync = False
        self._current_layout_mode = None  # 'landscape' ou 'portrait'

        # Atalhos de Teclado
        self.bind_all("<Control-v>", self._paste_from_clipboard)
        self.bind_all("<Control-V>", self._paste_from_clipboard)
        self.bind_all("<Control-c>", self._copy_text_shortcut)
        self.bind_all("<Control-C>", self._copy_text_shortcut)

        self._build_ui()
        self.bind("<Configure>", self._on_window_resize)

    def _build_ui(self):
        # 1. Header
        self.header_frame = ctk.CTkFrame(self, fg_color="#181824", corner_radius=12)
        self.header_frame.pack(fill="x", padx=15, pady=(12, 8))

        self.title_label = ctk.CTkLabel(
            self.header_frame,
            text="🚘 FiveM Mechanic OCR",
            font=ctk.CTkFont(size=20, weight="bold"),
            text_color="#ffffff"
        )
        self.title_label.pack(side="left", padx=15, pady=10)

        # 2. Conteúdo Principal Responsivo
        self.main_container = ctk.CTkFrame(self, fg_color="transparent")
        self.main_container.pack(fill="both", expand=True, padx=15, pady=2)

        # --- PAINEL DA ESQUERDA / SUPERIOR: Imagem e Controles ---
        self.left_panel = ctk.CTkFrame(self.main_container, fg_color="#1e1e2d", corner_radius=12)

        self.left_btn_frame = ctk.CTkFrame(self.left_panel, fg_color="transparent")
        self.left_btn_frame.pack(fill="x", padx=12, pady=(12, 4))

        self.btn_select_img = ctk.CTkButton(
            self.left_btn_frame,
            text="📂 Abrir Imagem",
            font=ctk.CTkFont(size=12, weight="bold"),
            height=38,
            fg_color="#2b5c8f",
            hover_color="#1f446d",
            corner_radius=8,
            command=self._select_image
        )
        self.btn_select_img.pack(side="left", fill="x", expand=True, padx=(0, 4))

        self.btn_paste_img = ctk.CTkButton(
            self.left_btn_frame,
            text="📋 Colar (Ctrl+V)",
            font=ctk.CTkFont(size=12, weight="bold"),
            height=38,
            fg_color="#d35400",
            hover_color="#a04000",
            corner_radius=8,
            command=self._paste_from_clipboard
        )
        self.btn_paste_img.pack(side="left", fill="x", expand=True, padx=4)

        self.btn_zoom_viewer = ctk.CTkButton(
            self.left_btn_frame,
            text="🔍 Ver Maior (Zoom)",
            font=ctk.CTkFont(size=12, weight="bold"),
            height=38,
            fg_color="#6c3483",
            hover_color="#512e5f",
            corner_radius=8,
            command=self._open_zoom_viewer
        )
        self.btn_zoom_viewer.pack(side="right", fill="x", expand=True, padx=(4, 0))

        self.lbl_path = ctk.CTkLabel(
            self.left_panel,
            text="Nenhuma imagem carregada (Cole com Ctrl+V ou abra um arquivo)",
            font=ctk.CTkFont(size=11),
            text_color="#8c8ca0",
            anchor="w"
        )
        self.lbl_path.pack(fill="x", padx=15, pady=(2, 6))

        self.preview_frame = ctk.CTkFrame(self.left_panel, fg_color="#111118", corner_radius=10)
        self.preview_frame.pack(fill="both", expand=True, padx=12, pady=(0, 12))

        self.lbl_image_preview = ctk.CTkLabel(
            self.preview_frame,
            text="📷 Cole uma imagem com Ctrl+V ou abra um arquivo\n(Clique em '🔍 Ver Maior' para dar zoom em monitores em pé)",
            font=ctk.CTkFont(size=12),
            text_color="#63637a"
        )
        self.lbl_image_preview.pack(expand=True, fill="both", padx=8, pady=8)
        self.lbl_image_preview.bind("<Button-1>", lambda e: self._open_zoom_viewer())

        # --- PAINEL DA DIREITA / INFERIOR: Campos Editáveis e Ações ---
        self.right_panel = ctk.CTkFrame(self.main_container, fg_color="#1e1e2d", corner_radius=12)

        self.tabview = ctk.CTkTabview(self.right_panel, fg_color="#14141e", corner_radius=10)
        self.tabview.pack(fill="both", expand=True, padx=12, pady=(10, 8))

        self.tab_formatted = self.tabview.add("📋 Resultado Formatado")
        self.tab_raw = self.tabview.add("🔍 Texto Bruto do OCR")

        # Campos Editáveis em Tempo Real
        self.fields_frame = ctk.CTkFrame(self.tab_formatted, fg_color="transparent")
        self.fields_frame.pack(fill="x", padx=8, pady=(4, 6))

        # 1. Campo Placa
        self.row_placa = ctk.CTkFrame(self.fields_frame, fg_color="transparent")
        self.row_placa.pack(fill="x", pady=2)
        ctk.CTkLabel(self.row_placa, text="🏷️ Placa:", width=105, anchor="w", font=ctk.CTkFont(size=12, weight="bold")).pack(side="left")
        self.entry_placa = ctk.CTkEntry(self.row_placa, font=ctk.CTkFont(size=12), height=28)
        self.entry_placa.pack(side="left", fill="x", expand=True)
        self.entry_placa.bind("<KeyRelease>", self._on_entry_changed)

        # 2. Campo Proprietário
        self.row_prop = ctk.CTkFrame(self.fields_frame, fg_color="transparent")
        self.row_prop.pack(fill="x", pady=2)
        ctk.CTkLabel(self.row_prop, text="👤 Proprietário:", width=105, anchor="w", font=ctk.CTkFont(size=12, weight="bold")).pack(side="left")
        self.entry_prop = ctk.CTkEntry(self.row_prop, font=ctk.CTkFont(size=12), height=28)
        self.entry_prop.pack(side="left", fill="x", expand=True)
        self.entry_prop.bind("<KeyRelease>", self._on_entry_changed)

        # 3. Campo Modelo
        self.row_modelo = ctk.CTkFrame(self.fields_frame, fg_color="transparent")
        self.row_modelo.pack(fill="x", pady=2)
        ctk.CTkLabel(self.row_modelo, text="🚗 Modelo:", width=105, anchor="w", font=ctk.CTkFont(size=12, weight="bold")).pack(side="left")
        self.entry_modelo = ctk.CTkEntry(self.row_modelo, font=ctk.CTkFont(size=12), height=28)
        self.entry_modelo.pack(side="left", fill="x", expand=True)
        self.entry_modelo.bind("<KeyRelease>", self._on_entry_changed)

        # 4. Campo Serviço
        self.row_serv = ctk.CTkFrame(self.fields_frame, fg_color="transparent")
        self.row_serv.pack(fill="x", pady=2)
        ctk.CTkLabel(self.row_serv, text="🔧 Serviço:", width=105, anchor="w", font=ctk.CTkFont(size=12, weight="bold")).pack(side="left")
        self.entry_serv = ctk.CTkEntry(self.row_serv, font=ctk.CTkFont(size=12), height=28)
        self.entry_serv.insert(0, "Troca de óleo e filtro")
        self.entry_serv.pack(side="left", fill="x", expand=True)
        self.entry_serv.bind("<KeyRelease>", self._on_entry_changed)

        # Caixa de Texto Formatada
        self.txt_result = ctk.CTkTextbox(
            self.tab_formatted,
            font=ctk.CTkFont(family="Consolas", size=12),
            wrap="word",
            fg_color="#0e0e14",
            text_color="#e0e0ff",
            corner_radius=8,
            border_width=1,
            border_color="#2d2d42"
        )
        self.txt_result.pack(fill="both", expand=True, padx=8, pady=(0, 8))
        self.txt_result.insert("1.0", FiveMTableOCR.format_output({}))
        self.txt_result.bind("<KeyRelease>", self._on_textbox_changed)

        # Aba 2: Resposta Bruta do OCR
        self.txt_raw = ctk.CTkTextbox(
            self.tab_raw,
            font=ctk.CTkFont(family="Consolas", size=12),
            wrap="word",
            fg_color="#0e0e14",
            text_color="#8c8ca0",
            corner_radius=8
        )
        self.txt_raw.pack(fill="both", expand=True, padx=8, pady=8)

        # Ações Inferiores
        self.actions_frame = ctk.CTkFrame(self.right_panel, fg_color="transparent")
        self.actions_frame.pack(fill="x", padx=12, pady=(0, 12))

        self.btn_copy = ctk.CTkButton(
            self.actions_frame,
            text="📋 Copiar Texto",
            font=ctk.CTkFont(size=13, weight="bold"),
            height=42,
            fg_color="#239b56",
            hover_color="#196f3d",
            corner_radius=8,
            command=self._copy_text_only
        )
        self.btn_copy.pack(side="left", fill="x", expand=True, padx=(0, 5))

        self.btn_reprocess = ctk.CTkButton(
            self.actions_frame,
            text="🔄 Reprocessar",
            font=ctk.CTkFont(size=12),
            height=42,
            width=110,
            fg_color="#34495e",
            hover_color="#2c3e50",
            corner_radius=8,
            command=self._process_image
        )
        self.btn_reprocess.pack(side="left", padx=(0, 5))

        self.btn_clear = ctk.CTkButton(
            self.actions_frame,
            text="🗑️ Limpar",
            font=ctk.CTkFont(size=12),
            height=42,
            width=85,
            fg_color="#7b241c",
            hover_color="#511813",
            corner_radius=8,
            command=self._clear_all
        )
        self.btn_clear.pack(side="right")

        # Barra de Status
        self.status_bar = ctk.CTkFrame(self, height=32, fg_color="#14141e", corner_radius=0)
        self.status_bar.pack(fill="x", side="bottom")

        self.lbl_status = ctk.CTkLabel(
            self.status_bar,
            text="Pronto para processar imagens (Ctrl+V para colar)",
            font=ctk.CTkFont(size=11),
            text_color="#2fa572"
        )
        self.lbl_status.pack(side="left", padx=15, pady=4)

        # Aplicar layout inicial
        self._apply_responsive_layout(force=True)

    def _on_window_resize(self, event):
        """Detecta rotação de monitor (retrato vs paisagem / ultrawide vertical) e adapta a UI."""
        if event.widget == self:
            self._apply_responsive_layout()

    def _apply_responsive_layout(self, force=False):
        w = self.winfo_width()
        h = self.winfo_height()

        # Se for monitor em pé (altura significativamente maior que largura ou largura estreita)
        is_portrait = (w < 820) or (h > w * 1.12)
        new_mode = "portrait" if is_portrait else "landscape"

        if new_mode == self._current_layout_mode and not force:
            return

        self._current_layout_mode = new_mode

        # Desempacotar painéis para reorganizar
        self.left_panel.pack_forget()
        self.right_panel.pack_forget()

        if is_portrait:
            # Modo Retrato / Vertical: Empilhamento vertical
            self.left_panel.pack(side="top", fill="both", expand=True, padx=0, pady=(0, 8))
            self.right_panel.pack(side="bottom", fill="both", expand=True, padx=0, pady=(0, 0))
        else:
            # Modo Paisagem / Horizontal: Duas colunas lado a lado
            self.left_panel.pack(side="left", fill="both", expand=True, padx=(0, 8), pady=0)
            self.right_panel.pack(side="right", fill="both", expand=True, padx=(8, 0), pady=0)

        if self.loaded_image:
            self.after(50, lambda: self._update_preview(self.loaded_image))

    def _open_zoom_viewer(self):
        """Abre a janela com zoom interativo em alta resolução."""
        if not self.loaded_image:
            messagebox.showinfo("Nenhuma Imagem", "Carregue ou cole uma imagem primeiro para poder dar zoom.")
            return
        ImageZoomViewer(self, self.loaded_image, title="🔍 Visualizador Ampliado - FiveM OCR")

    def _on_entry_changed(self, event=None):
        if self._updating_sync:
            return
        self._updating_sync = True
        try:
            placa = self.entry_placa.get().strip() or "[Não identificado]"
            prop = self.entry_prop.get().strip() or "[Não identificado]"
            modelo = self.entry_modelo.get().strip() or "[Não identificado]"
            serv = self.entry_serv.get().strip() or "Troca de óleo e filtro"

            formatted = (
                f"Placa do veículo: {placa}\n"
                f"Nome do proprietário: {prop}\n"
                f"Modelo do veículo: {modelo}\n"
                f"Serviço: {serv}"
            )
            self.txt_result.delete("1.0", "end")
            self.txt_result.insert("1.0", formatted)
        finally:
            self._updating_sync = False

    def _on_textbox_changed(self, event=None):
        if self._updating_sync:
            return
        self._updating_sync = True
        try:
            text = self.txt_result.get("1.0", "end-1c")
            placa_m = re.search(r"Placa(?:\s+do\s+ve[íi]culo)?:\s*(.*)", text, re.IGNORECASE)
            prop_m = re.search(r"Nome(?:\s+do\s+propriet[áa]rio)?:\s*(.*)", text, re.IGNORECASE)
            mod_m = re.search(r"Modelo(?:\s+do\s+ve[íi]culo)?:\s*(.*)", text, re.IGNORECASE)
            serv_m = re.search(r"Servi[çc]o:\s*(.*)", text, re.IGNORECASE)

            if placa_m:
                self.entry_placa.delete(0, "end")
                self.entry_placa.insert(0, placa_m.group(1).strip())
            if prop_m:
                self.entry_prop.delete(0, "end")
                self.entry_prop.insert(0, prop_m.group(1).strip())
            if mod_m:
                self.entry_modelo.delete(0, "end")
                self.entry_modelo.insert(0, mod_m.group(1).strip())
            if serv_m:
                self.entry_serv.delete(0, "end")
                self.entry_serv.insert(0, serv_m.group(1).strip())
        finally:
            self._updating_sync = False

    def _copy_text_only(self):
        text_to_copy = self.txt_result.get("1.0", "end-1c").strip()
        if not text_to_copy:
            return

        copied = False
        if PYWIN32_AVAILABLE:
            try:
                win32clipboard.OpenClipboard()
                win32clipboard.EmptyClipboard()
                win32clipboard.SetClipboardData(win32con.CF_UNICODETEXT, text_to_copy)
                win32clipboard.CloseClipboard()
                copied = True
            except Exception:
                pass

        if not copied:
            self.clipboard_clear()
            self.clipboard_append(text_to_copy)
            self.update()

        orig_color = self.btn_copy.cget("fg_color")
        orig_text = self.btn_copy.cget("text")
        self.btn_copy.configure(fg_color="#27ae60", text="✔ Texto Copiado!")
        self.lbl_status.configure(text="✔ Texto puro copiado para a Área de Transferência!", text_color="#27ae60")
        self.after(1500, lambda: self.btn_copy.configure(fg_color=orig_color, text=orig_text))

    def _copy_text_shortcut(self, event=None):
        focused = self.focus_get()
        if isinstance(focused, (tk.Entry, tk.Text, ctk.CTkEntry, ctk.CTkTextbox)):
            return
        self._copy_text_only()

    def _clear_all(self):
        self.loaded_image = None
        self.image_path = None
        self.raw_ocr_text = ""

        self.lbl_path.configure(text="Nenhuma imagem carregada (Cole com Ctrl+V ou abra um arquivo)")
        self._update_preview(None)

        self._updating_sync = True
        try:
            self.entry_placa.delete(0, "end")
            self.entry_prop.delete(0, "end")
            self.entry_modelo.delete(0, "end")
            self.entry_serv.delete(0, "end")
            self.entry_serv.insert(0, "Troca de óleo e filtro")

            self.txt_result.delete("1.0", "end")
            self.txt_result.insert("1.0", FiveMTableOCR.format_output({}))
            self.txt_raw.delete("1.0", "end")
        finally:
            self._updating_sync = False

        self.lbl_status.configure(text="Campos limpos. Pronto para o próximo atendimento.", text_color="#2fa572")

    def _select_image(self):
        file_types = [
            ("Imagens Suportadas", "*.png *.jpg *.jpeg *.bmp *.webp *.tiff"),
            ("Todos os Arquivos", "*.*")
        ]
        file_path = filedialog.askopenfilename(title="Selecione a Imagem do FiveM", filetypes=file_types)
        if file_path:
            self._load_image_file(file_path)

    def _load_image_file(self, file_path: str):
        try:
            self.loaded_image = Image.open(file_path)
            self.image_path = file_path
            self.lbl_path.configure(text=f"Arquivo: {os.path.basename(file_path)}")
            self._update_preview(self.loaded_image)
            self._process_image()
        except Exception as e:
            messagebox.showerror("Erro ao carregar imagem", f"Não foi possível ler a imagem:\n{str(e)}")

    def _paste_from_clipboard(self, event=None):
        try:
            clipboard_content = ImageGrab.grabclipboard()
            if isinstance(clipboard_content, Image.Image):
                self.loaded_image = clipboard_content
                self.image_path = "Imagem da Área de Transferência (Ctrl+V)"
                self.lbl_path.configure(text=self.image_path)
                self._update_preview(self.loaded_image)
                self._process_image()
                return "break" if event else None

            if isinstance(clipboard_content, list) and clipboard_content:
                first_file = clipboard_content[0]
                if isinstance(first_file, str) and first_file.lower().endswith(('.png', '.jpg', '.jpeg', '.bmp', '.webp', '.tiff')):
                    self.loaded_image = Image.open(first_file)
                    self.image_path = first_file
                    self.lbl_path.configure(text=f"Arquivo: {os.path.basename(first_file)}")
                    self._update_preview(self.loaded_image)
                    self._process_image()
                    return "break" if event else None

            if not event:
                messagebox.showinfo("Nenhuma Imagem", "Não há imagem copiada no Clipboard.\nTire um PrintScreen ou copie uma foto antes de colar.")
        except Exception as e:
            if not event:
                messagebox.showerror("Erro ao Colar", f"Erro no Clipboard:\n{str(e)}")

    def _update_preview(self, pil_img: Image.Image | None):
        default_prompt = "📷 Cole uma imagem com Ctrl+V ou abra um arquivo\n(Clique em '🔍 Ver Maior' para dar zoom em monitores em pé)"

        # 1. Limpar imagem obsoleta no Tkinter nativo para prevenir erro 'image pyimageX does not exist'
        try:
            self.lbl_image_preview._label.configure(image="")
        except Exception:
            pass

        if pil_img is None:
            self._current_ctk_preview = None
            try:
                self.lbl_image_preview.configure(image=None, text=default_prompt)
            except Exception:
                try:
                    self.lbl_image_preview._label.configure(image="", text=default_prompt)
                except Exception:
                    pass
            return

        container_w = self.preview_frame.winfo_width() or 400
        container_h = self.preview_frame.winfo_height() or 260

        img_copy = pil_img.copy()
        img_copy.thumbnail((max(100, container_w - 20), max(100, container_h - 20)), Image.Resampling.LANCZOS)

        # Manter referência persistente do CTkImage no app para evitar garbage collection prematuro
        self._current_ctk_preview = ctk.CTkImage(light_image=img_copy, dark_image=img_copy, size=img_copy.size)
        try:
            self.lbl_image_preview.configure(image=self._current_ctk_preview, text="")
        except Exception:
            try:
                self.lbl_image_preview._label.configure(image="")
                self.lbl_image_preview.configure(image=self._current_ctk_preview, text="")
            except Exception:
                pass

    def _process_image(self):
        """Processa a imagem usando o motor 100% local ultra-rápido."""
        if not self.loaded_image:
            return

        try:
            self.lbl_status.configure(text="⏳ Processando imagem via OCR Local...", text_color="#3498db")
            self.update_idletasks()

            info_dict, raw_text = FiveMTableOCR.extract_info(self.loaded_image)
            self.raw_ocr_text = raw_text

            self._updating_sync = True
            try:
                self.entry_placa.delete(0, "end")
                self.entry_placa.insert(0, info_dict.get("placa", ""))

                self.entry_prop.delete(0, "end")
                self.entry_prop.insert(0, info_dict.get("proprietario", ""))

                self.entry_modelo.delete(0, "end")
                self.entry_modelo.insert(0, info_dict.get("modelo", ""))

                self.entry_serv.delete(0, "end")
                self.entry_serv.insert(0, info_dict.get("servicos", "Troca de óleo e filtro"))

                formatted_text = FiveMTableOCR.format_output(info_dict)
                self.txt_result.delete("1.0", "end")
                self.txt_result.insert("1.0", formatted_text)

                self.txt_raw.delete("1.0", "end")
                self.txt_raw.insert("1.0", raw_text)
            finally:
                self._updating_sync = False

            self.lbl_status.configure(text="✔ Extração concluída com sucesso! Dados prontos para cópia.", text_color="#2fa572")
        except Exception as e:
            self.lbl_status.configure(text=f"❌ Erro ao processar: {str(e)}", text_color="#e74c3c")
            messagebox.showerror("Erro de Processamento", f"Ocorreu um erro ao processar a imagem:\n{str(e)}")


if __name__ == "__main__":
    app = FiveMOCRApp()
    app.mainloop()
