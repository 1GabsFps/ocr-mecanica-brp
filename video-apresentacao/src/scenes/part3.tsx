import { motion } from 'framer-motion';
import { Appear, Count, Header, Typer, ease, prog, useElapsed } from '../common';

/* ============================================================
 * 08 — Backend VPS & Telemetria
 * ============================================================ */
const TABLES = ['extractions', 'funcionarios', 'sessions', 'inventory', 'inventory_transactions', 'work_hours', 'member_roles', 'audit_logs', 'faturas', 'work_hours_cycles', 'work_hours_archive'];

export function Backend() {
  const t = useElapsed();
  const pragma = `PRAGMA journal_mode = WAL;\nPRAGMA synchronous  = NORMAL;\nPRAGMA busy_timeout = 10000;`;
  const sec = [
    { i: '🎮', t: 'Login Steam OpenID', d: 'token de 256 bits · sessão de 7 dias' },
    { i: '🧱', t: 'Rate limit & lockout', d: '5 tentativas / 15 min por IP' },
    { i: '🔐', t: 'Segredos isolados', d: 'tokens e webhooks só no .env' },
    { i: '🚀', t: 'Deploy atômico', d: 'releases/<id> → current → Nginx SSL' },
  ];
  return (
    <div className="scene">
      <Header num="08" kicker="Backend & Telemetria" title={<>Leve, concorrente e <span className="grad">sem dependências pesadas</span></>} lead={<>Python <span className="mono cyan">ThreadingHTTPServer</span> + SQLite em modo WAL na VPS Ubuntu.</>} />

      <div className="row" style={{ gap: 32, marginTop: 40, alignItems: 'stretch' }}>
        <Appear delay={0.3} className="panel col" style={{ width: 560, padding: 30, gap: 20 }}>
          <div className="row" style={{ gap: 14 }}>
            <span style={{ fontSize: 40 }}>🐍</span>
            <div className="col">
              <b style={{ fontSize: 26 }}>server.py</b>
              <span className="mono muted" style={{ fontSize: 16 }}>vps-telemetry/</span>
            </div>
          </div>
          <div className="code" style={{ color: 'var(--gold)' }}>
            <Typer text={pragma} t={t} start={0.9} cps={30} />
          </div>
          <div className="col" style={{ gap: 12 }}>
            {[
              ['Leitores simultâneos', 'sem bloqueio na escrita'],
              ['Menos fsync()', 'ACID preservado'],
              ['Fim do "database is locked"', 'espera até 10 s'],
            ].map(([a, b], k) => (
              <Appear key={a} delay={2.4 + k * 0.2} x={-20} className="row" style={{ gap: 12, fontSize: 19 }}>
                <span className="green">✓</span><b>{a}</b><span className="muted">· {b}</span>
              </Appear>
            ))}
          </div>
        </Appear>

        <Appear delay={0.5} className="panel col" style={{ flex: 1, padding: 30, gap: 18 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <b style={{ fontSize: 24 }}>🗄️ telemetry.db</b>
            <span className="mono gold" style={{ fontSize: 22 }}><Count t={t} start={0.8} dur={2.2} to={11} /> tabelas</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {TABLES.map((tb, k) => (
              <motion.div key={tb} initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.8 + k * 0.2, ease }} className="mono" style={{ padding: '11px 14px', borderRadius: 10, background: 'rgba(34,211,238,.07)', border: '1px solid rgba(34,211,238,.25)', fontSize: 16, whiteSpace: 'nowrap' }}>
                ▦ {tb}
              </motion.div>
            ))}
          </div>
        </Appear>

        <div className="col" style={{ width: 470, gap: 16 }}>
          {sec.map((s, k) => (
            <Appear key={s.t} delay={1.2 + k * 0.3} x={40} className="panel row" style={{ padding: '20px 22px', gap: 16, flex: 1 }}>
              <span style={{ fontSize: 34 }}>{s.i}</span>
              <div className="col">
                <b style={{ fontSize: 21 }}>{s.t}</b>
                <span className="muted mono" style={{ fontSize: 15, marginTop: 4 }}>{s.d}</span>
              </div>
            </Appear>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 * 09 — Cliente Desktop
 * ============================================================ */
export function Desktop() {
  const t = useElapsed();
  const sel = prog(t, 1.3, 1.1);
  const ocr = t > 2.7;
  return (
    <div className="scene">
      <Header num="09" kicker="Cliente Desktop · Windows" title={<>Um <span className="grad">.exe</span> que lê a tela do jogo em <span className="green">~300 ms</span></>} />

      <div className="row" style={{ gap: 50, marginTop: 40, alignItems: 'flex-start' }}>
        <Appear delay={0.3} y={50} className="panel" style={{ width: 980, overflow: 'hidden', background: '#1a1d21', borderColor: '#2b3036' }}>
          <div className="row" style={{ padding: '12px 18px', background: '#22262b', gap: 10 }}>
            <img src="/assets/logo.png" style={{ width: 24, height: 24, clipPath: 'circle(44%)' }} />
            <span style={{ fontSize: 17 }}>FiveM OCR Mecânica</span>
            <span className="muted" style={{ marginLeft: 'auto', letterSpacing: 12 }}>— ☐ ✕</span>
          </div>
          <div className="row" style={{ padding: 22, gap: 20, alignItems: 'flex-start' }}>
            <div className="col" style={{ width: 250, gap: 12 }}>
              {['✂️  Região selecionada', '🪟  Janela do FiveM', '📋  Área de transferência'].map((b, k) => (
                <motion.div key={b} animate={{ background: k === 0 ? '#1f6aa5' : '#2b2f35' }} style={{ padding: '14px 16px', borderRadius: 8, fontSize: 18, fontWeight: 600 }}>{b}</motion.div>
              ))}
              <div className="mono muted" style={{ fontSize: 14, marginTop: 8 }}>CustomTkinter · tema escuro</div>
            </div>
            <div className="col" style={{ flex: 1, gap: 14 }}>
              <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden' }}>
                <img src="/assets/screenshot.jpg" style={{ width: '100%', display: 'block', filter: t > 1.2 && t < 2.6 ? 'brightness(.55)' : undefined }} />
                {t > 1.2 && (
                  <div style={{ position: 'absolute', left: '15.8%', top: '35.4%', width: `${sel * 70}%`, height: `${sel * 11}%`, border: '2px dashed #fff', background: 'rgba(255,255,255,.08)', boxShadow: '0 0 0 9999px rgba(0,0,0,.0)' }} />
                )}
              </div>
              <div className="row" style={{ gap: 10 }}>
                {[
                  ['Placa', 'WWX 2364'],
                  ['Proprietário', 'Maicon Douglas'],
                  ['Carro', 'Saveiro G4'],
                ].map(([l, v], k) => (
                  <div key={l} className="col" style={{ flex: 1, padding: '10px 12px', borderRadius: 8, background: '#2b2f35' }}>
                    <span className="muted" style={{ fontSize: 13 }}>{l}</span>
                    <span className="mono" style={{ fontSize: 18, minHeight: 24 }}>{ocr && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: k * 0.1 }}>{v}</motion.span>}</span>
                  </div>
                ))}
              </div>
              {t > 3.4 && (
                <Appear y={10} className="badge" style={{ background: 'rgba(34,197,94,.15)', color: 'var(--green)', alignSelf: 'flex-start' }}>
                  ✓ Copiado (CF_UNICODETEXT) — pronto para Ctrl+V no jogo
                </Appear>
              )}
            </div>
          </div>
        </Appear>

        <div className="col" style={{ flex: 1, gap: 18 }}>
          {[
            { i: '🧠', t: 'RapidOCR + ONNX Runtime', d: 'DBNet (detecção) + CRNN (reconhecimento)' },
            { i: '📐', t: 'FiveMTableOCR', d: 'fatiamento X₁–X₂ por cabeçalho de coluna' },
            { i: '📋', t: 'Clipboard nativo win32', d: 'acentos perfeitos, sem Latin-1 quebrado' },
            { i: '📦', t: 'PyInstaller', d: 'executável único, portátil, sem console' },
          ].map((f, k) => (
            <Appear key={f.t} delay={0.6 + k * 0.25} x={40} className="panel row" style={{ padding: '20px 22px', gap: 16 }}>
              <span style={{ fontSize: 34 }}>{f.i}</span>
              <div className="col">
                <b style={{ fontSize: 22 }}>{f.t}</b>
                <span className="muted" style={{ fontSize: 17, marginTop: 4 }}>{f.d}</span>
              </div>
            </Appear>
          ))}
          <Appear delay={2} className="row" style={{ gap: 16, marginTop: 6 }}>
            <span className="chip" style={{ fontSize: 18 }}>⚡ 300–500 ms na CPU</span>
            <span className="chip" style={{ fontSize: 18 }}>🔌 100% offline</span>
          </Appear>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 * 10 — Auditoria & Qualidade
 * ============================================================ */
export function Audit() {
  const t = useElapsed();
  const sev = [
    { n: 'Crítico', v: 6, c: '#ef4444' },
    { n: 'Alto', v: 10, c: '#f97316' },
    { n: 'Médio', v: 6, c: '#fbbf24' },
    { n: 'Baixo', v: 2, c: '#22c55e' },
  ];
  const fixes = [
    { b: 'Web Audio', d: 'Lazy Singleton contra o limite de 6 AudioContext' },
    { b: 'Race condition no OCR', d: 'activeProcessIdRef + AbortController' },
    { b: 'LocalStorage 5 MB', d: '30 itens + thumbnails 160×160 (<3 KB)' },
    { b: 'Loop de 720 FPS', d: 'guarda em useCountUp + React.memo' },
    { b: 'SQLite travando', d: 'ThreadingHTTPServer + WAL' },
  ];
  const maint = ['seed_inventory.py', 'sync_official_roster.py', 'compare_members.py', 'download_discord_images.py', 'YOLOv11n · detector de menu', 'testes adversariais E2E'];
  return (
    <div className="scene">
      <Header num="10" kicker="Auditoria & qualidade" title={<>100% do código auditado, <span className="grad">24 falhas corrigidas</span></>} />

      <div className="row" style={{ gap: 40, marginTop: 40, alignItems: 'stretch' }}>
        <Appear delay={0.3} className="panel col" style={{ width: 620, padding: 36, gap: 22 }}>
          <div className="mono" style={{ fontSize: 140, fontWeight: 800, lineHeight: 1 }}>
            <span className="grad"><Count t={t} start={0.5} dur={1.8} to={24} /></span>
          </div>
          <span className="muted" style={{ fontSize: 22, marginTop: -6 }}>correções de arquitetura, memória e segurança</span>
          {sev.map((s, k) => (
            <div key={s.n} className="row" style={{ gap: 16 }}>
              <span style={{ width: 90, fontSize: 19, fontWeight: 700 }}>{s.n}</span>
              <div className="bar-track" style={{ flex: 1, height: 20 }}>
                <div className="bar-fill" style={{ width: `${prog(t, 0.8 + k * 0.2, 1.1) * s.v * 10}%`, background: s.c, boxShadow: `0 0 16px ${s.c}` }} />
              </div>
              <span className="mono" style={{ width: 30, fontSize: 20, fontWeight: 800, color: s.c }}>{s.v}</span>
            </div>
          ))}
        </Appear>

        <div className="col" style={{ flex: 1, gap: 14 }}>
          {fixes.map((f, k) => (
            <Appear key={f.b} delay={0.8 + k * 0.25} x={40} className="panel row" style={{ padding: '16px 22px', gap: 16 }}>
              <span className="green" style={{ fontSize: 24 }}>✓</span>
              <b style={{ fontSize: 21, minWidth: 290 }}>{f.b}</b>
              <span className="muted" style={{ fontSize: 18 }}>{f.d}</span>
            </Appear>
          ))}
          <div className="chip-row" style={{ justifyContent: 'flex-start', marginTop: 10 }}>
            {maint.map((m, k) => (
              <motion.span key={m} className="chip mono" style={{ fontSize: 15 }} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.4 + k * 0.12, ease }}>
                {m}
              </motion.span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 * 11 — Arquitetura
 * ============================================================ */
type N = { id: string; x: number; y: number; icon: string; title: string; sub: string; color: string };
const NODES: N[] = [
  { id: 'discord', x: 380, y: 330, icon: '💬', title: 'Discord', sub: '#ponto · #baú · #faturas', color: '#5865f2' },
  { id: 'game', x: 960, y: 330, icon: '🎮', title: 'FiveM (jogo)', sub: 'HUD da mecânica', color: '#94a3b8' },
  { id: 'gemini', x: 1540, y: 330, icon: '✨', title: 'Gemini AI', sub: 'Flash Lite · Hedged', color: '#a78bfa' },
  { id: 'watcher', x: 380, y: 640, icon: '⚡', title: 'Watcher Discord', sub: 'websockets · asyncio', color: '#22c55e' },
  { id: 'backend', x: 960, y: 640, icon: '🗄️', title: 'Backend & Telemetria', sub: 'ThreadingHTTPServer · SQLite WAL', color: '#fbbf24' },
  { id: 'web', x: 1540, y: 640, icon: '💻', title: 'Cliente Web PWA', sub: 'React 19 · Vite · Tesseract.js', color: '#22d3ee' },
  { id: 'desktop', x: 1540, y: 900, icon: '🖥️', title: 'Cliente Desktop', sub: 'CustomTkinter · RapidOCR', color: '#f97316' },
];
const node = (id: string) => NODES.find((n) => n.id === id)!;
const EDGES: { a: string; b: string; d: string; label?: string }[] = [
  { a: 'discord', b: 'watcher', d: 'M380 380 L380 590', label: 'MESSAGE_CREATE' },
  { a: 'watcher', b: 'backend', d: 'M560 640 L780 640', label: 'live-log' },
  { a: 'web', b: 'backend', d: 'M1360 640 L1140 640', label: 'REST' },
  { a: 'web', b: 'gemini', d: 'M1540 590 L1540 380', label: 'OCR' },
  { a: 'game', b: 'web', d: 'M1080 380 Q1300 470 1440 590', label: 'print' },
  { a: 'game', b: 'desktop', d: 'M1140 350 C1260 420 1260 880 1360 900', label: 'captura' },
];

export function Architecture() {
  const t = useElapsed();
  return (
    <div className="scene">
      <Header num="11" kicker="Arquitetura" title={<>4 camadas, <span className="grad">um ecossistema sincronizado</span></>} />

      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        {EDGES.map((e, k) => (
          <g key={k}>
            <motion.path d={e.d} fill="none" stroke="rgba(34,211,238,.35)" strokeWidth={3} strokeDasharray="0" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 1.4 + k * 0.25, duration: 0.9, ease }} />
          </g>
        ))}
      </svg>

      {/* moving packets along edges */}
      {t > 2.8 &&
        EDGES.map((e, k) => (
          <motion.div
            key={'p' + k}
            style={{ position: 'absolute', left: 0, top: 0, width: 14, height: 14, borderRadius: '50%', background: node(e.a).color, boxShadow: `0 0 18px ${node(e.a).color}`, offsetPath: `path('${e.d}')`, offsetRotate: '0deg', marginLeft: -7, marginTop: -7 } as React.CSSProperties}
            initial={{ offsetDistance: '0%' } as any}
            animate={{ offsetDistance: '100%' } as any}
            transition={{ duration: 1.6, repeat: Infinity, delay: k * 0.3, ease: 'easeInOut' }}
          />
        ))}

      {NODES.map((n, k) => (
        <motion.div
          key={n.id}
          className="panel row"
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 + k * 0.12, type: 'spring', stiffness: 120, damping: 14 }}
          style={{ position: 'absolute', left: n.x - 180, top: n.y - 50, width: 360, height: 100, padding: '0 20px', gap: 16, borderColor: n.color + '88', boxShadow: `0 0 40px ${n.color}22` }}
        >
          <span style={{ fontSize: 38 }}>{n.icon}</span>
          <div className="col">
            <b style={{ fontSize: 22 }}>{n.title}</b>
            <span className="muted mono" style={{ fontSize: 14 }}>{n.sub}</span>
          </div>
        </motion.div>
      ))}

      {t > 3.5 && (
        <Appear y={20} className="panel" style={{ position: 'absolute', left: 110, top: 850, width: 900, padding: '20px 26px', fontSize: 20, lineHeight: 1.5 }}>
          <b className="gold">Zero custo de operação:</b> <span className="muted">Gemini gratuito com Hedged Racing, contingência 100% local (Tesseract.js / RapidOCR) e WebSocket passivo.</span>
        </Appear>
      )}
    </div>
  );
}

/* ============================================================
 * 12 — Encerramento
 * ============================================================ */
export function Outro() {
  const t = useElapsed();
  const stats = [
    { v: <Count t={t} start={0.5} dur={1.6} from={45} to={1.2} decimals={1} suffix="s" />, l: 'por ficha de atendimento', c: 'var(--green)' },
    { v: '3', l: 'níveis de OCR híbrido', c: 'var(--cyan)' },
    { v: '24/7', l: 'sincronização em tempo real', c: '#aab1ff' },
    { v: 'R$ 0', l: 'custo de operação', c: 'var(--gold)' },
  ];
  return (
    <div className="center-col" style={{ height: '100%', gap: 60 }}>
      <div className="row" style={{ gap: 30 }}>
        {stats.map((s, k) => (
          <Appear key={k} delay={0.2 + k * 0.15} y={40} className="panel col" style={{ width: 330, padding: '34px 20px', alignItems: 'center', gap: 10 }}>
            <span className="mono" style={{ fontSize: 66, fontWeight: 800, color: s.c }}>{s.v}</span>
            <span className="muted" style={{ fontSize: 20 }}>{s.l}</span>
          </Appear>
        ))}
      </div>

      <motion.div className="row" style={{ gap: 36 }} initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.6, duration: 0.9, ease }}>
        <motion.img src="/assets/logo.png" style={{ width: 170, height: 170, clipPath: 'circle(44%)', filter: 'drop-shadow(0 0 40px rgba(34,211,238,.5))' }} animate={{ rotate: [0, 360] }} transition={{ duration: 30, repeat: Infinity, ease: 'linear' }} />
        <div className="col" style={{ alignItems: 'flex-start' }}>
          <span className="title-xl" style={{ fontSize: 110 }}>Mecânica BRP</span>
          <span style={{ fontSize: 30, color: 'var(--muted)' }}>
            OCR inteligente + gestão completa da oficina · <span className="mono cyan">mecanica.neco.lat</span>
          </span>
        </div>
      </motion.div>
    </div>
  );
}
