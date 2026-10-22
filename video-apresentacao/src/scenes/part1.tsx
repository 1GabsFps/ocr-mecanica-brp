import { motion } from 'framer-motion';
import { Appear, Count, Header, Typer, ease, prog, useElapsed } from '../common';

/* ============================================================
 * 01 — Abertura
 * ============================================================ */
export function Intro() {
  const title = 'MECÂNICA BRP';
  const chips = ['React 19', 'Gemini AI', 'Tesseract.js', 'RapidOCR', 'Python', 'SQLite WAL', 'Discord Gateway'];
  return (
    <div className="center-col" style={{ height: '100%', gap: 30 }}>
      <motion.div
        style={{ position: 'relative', width: 320, height: 320 }}
        initial={{ scale: 0, rotate: -140, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 70, damping: 13 }}
      >
        <motion.div
          style={{ position: 'absolute', inset: 10, borderRadius: '50%', border: '3px solid var(--cyan)' }}
          animate={{ scale: [1, 1.35], opacity: [0.7, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
        />
        <img src="/assets/logo.png" style={{ width: '100%', height: '100%', clipPath: 'circle(44%)', filter: 'drop-shadow(0 0 40px rgba(34,211,238,.5))' }} />
      </motion.div>

      <div className="title-xl">
        {title.split('').map((c, k) => (
          <motion.span
            key={k}
            style={{ display: 'inline-block', whiteSpace: 'pre' }}
            initial={{ y: 90, opacity: 0, rotateX: -80 }}
            animate={{ y: 0, opacity: 1, rotateX: 0 }}
            transition={{ delay: 0.7 + k * 0.05, duration: 0.8, ease }}
          >
            {c}
          </motion.span>
        ))}
      </div>

      <Appear delay={1.6}>
        <p style={{ fontSize: 34, color: 'var(--muted)', fontWeight: 500 }}>
          Sistema Integrado de <b className="cyan">OCR</b> &amp; <b className="gold">Gestão</b> para oficinas no FiveM · GTA V Roleplay
        </p>
      </Appear>

      <div className="chip-row" style={{ marginTop: 16 }}>
        {chips.map((c, k) => (
          <motion.span key={c} className="chip" initial={{ opacity: 0, y: 20, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 2.3 + k * 0.1, duration: 0.5, ease }}>
            {c}
          </motion.span>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
 * 02 — O problema
 * ============================================================ */
function FormCard({ title, accent, children, timer }: { title: string; accent: string; children: React.ReactNode; timer: React.ReactNode }) {
  return (
    <div className="panel" style={{ flex: 1, padding: 40, borderColor: accent + '55' }}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 30 }}>
        <span style={{ fontSize: 28, fontWeight: 800 }}>{title}</span>
        <span className="mono" style={{ fontSize: 56, fontWeight: 800, color: accent }}>{timer}</span>
      </div>
      <div className="col" style={{ gap: 22 }}>{children}</div>
    </div>
  );
}

export function Problem() {
  const t = useElapsed();
  const showFix = t > 3.0;
  const filled = t > 4.3;
  return (
    <div className="scene">
      <Header num="02" kicker="O problema" title={<>Fichas de atendimento <span className="red">digitadas à mão</span></>} lead="Placas Mercosul, nomes e modelos customizados do FiveM: lento, cansativo e cheio de erros." />

      <div className="row" style={{ gap: 50, marginTop: 50, alignItems: 'stretch' }}>
        <Appear delay={0.4} x={-40} style={{ flex: 1, display: 'flex' }}>
          <FormCard title="⌨️  Digitação manual" accent="#ef4444" timer={<Count t={t} start={0.5} dur={6} to={45} suffix="s" />}>
            <div className="field">
              <label>Placa</label>
              <div className="input" style={{ color: t > 2.2 ? 'var(--red)' : undefined, textDecoration: t > 2.2 ? 'line-through' : undefined }}>
                <Typer text="WXW 2346" t={t} start={0.7} cps={5} />
              </div>
            </div>
            <div className="field">
              <label>Proprietário</label>
              <div className="input" style={{ color: t > 4.6 ? 'var(--red)' : undefined, textDecoration: t > 4.6 ? 'line-through' : undefined }}>
                <Typer text="Maicon Duglas" t={t} start={2.3} cps={5.5} />
              </div>
            </div>
            <div className="field">
              <label>Modelo</label>
              <div className="input"><Typer text="Saveiro G..." t={t} start={4.8} cps={4} /></div>
            </div>
            {t > 2.4 && (
              <Appear y={10} className="badge" style={{ background: 'rgba(239,68,68,.15)', color: 'var(--red)', alignSelf: 'flex-start' }}>
                ⚠ erros de digitação detectados
              </Appear>
            )}
          </FormCard>
        </Appear>

        {showFix && (
          <Appear x={40} style={{ flex: 1, display: 'flex' }}>
            <FormCard title="⚡  Com Mecânica BRP" accent="#22c55e" timer={filled ? '1,2s' : '—'}>
              <div className="row" style={{ gap: 12, marginBottom: 6 }}>
                <motion.span className="key" animate={t > 3.6 && t < 4.1 ? { y: 4, borderBottomWidth: 1 } : { y: 0 }}>Ctrl</motion.span>
                <span style={{ fontSize: 26 }}>+</span>
                <motion.span className="key" animate={t > 3.7 && t < 4.1 ? { y: 4, borderBottomWidth: 1 } : { y: 0 }}>V</motion.span>
                <span className="muted" style={{ fontSize: 22, marginLeft: 10 }}>cola o print do jogo</span>
              </div>
              {[
                ['Placa', 'WWX 2364'],
                ['Proprietário', 'Maicon Douglas'],
                ['Modelo', 'Saveiro G4'],
              ].map(([l, v], k) => (
                <div className="field" key={l}>
                  <label>{l}</label>
                  <motion.div
                    className="input"
                    animate={filled ? { borderColor: 'rgba(34,197,94,.6)', backgroundColor: 'rgba(34,197,94,.08)' } : {}}
                    transition={{ delay: k * 0.08 }}
                  >
                    {filled && (
                      <motion.span initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: k * 0.08 }} style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                        {v} <span className="green">✓</span>
                      </motion.span>
                    )}
                  </motion.div>
                </div>
              ))}
            </FormCard>
          </Appear>
        )}
      </div>

      {t > 6 && (
        <Appear y={20} style={{ position: 'absolute', left: 0, right: 0, bottom: 120, textAlign: 'center', fontSize: 40, fontWeight: 800 }}>
          <span className="grad">~45s → ~1,2s</span> por atendimento · <span className="green">−97% de tempo</span>
        </Appear>
      )}
    </div>
  );
}

/* ============================================================
 * 03 — Pipeline de OCR
 * ============================================================ */
const COLS = [
  { label: 'Placa', left: 16.5, width: 8.2, color: '#22d3ee' },
  { label: 'Proprietário', left: 24.9, width: 12.5, color: '#fbbf24' },
  { label: 'Carro', left: 37.5, width: 8.6, color: '#a78bfa' },
];

const STEPS = [
  { icon: '🖼️', title: 'Pré-processamento', desc: '1280px · JPEG 0.82 · 8 MB → ~45 KB' },
  { icon: '✨', title: 'Gemini Flash Lite', desc: 'Hedged Racing · schema estrito de 3 campos' },
  { icon: '🧩', title: 'Fallback Tesseract.js', desc: 'Web Worker WASM · 2 passos · 100% offline' },
  { icon: '🧹', title: 'Normalização Regex', desc: 'ABC1D23 → ABC 1D23 · GabrielSantos → Gabriel Santos' },
];

export function OcrPipeline() {
  const t = useElapsed();
  const activeStep = Math.floor((t - 1.2) / 1.4);
  const json = `{\n  "placa": "WWX 2364",\n  "proprietario": "Maicon Douglas",\n  "modelo": "Saveiro G4"\n}`;
  return (
    <div className="scene">
      <Header num="03" kicker="Núcleo tecnológico" title={<>Do print à ficha com <span className="grad">OCR híbrido</span></>} />

      <div className="row" style={{ gap: 50, marginTop: 40, alignItems: 'flex-start' }}>
        {/* Screenshot */}
        <Appear delay={0.3} x={-50} className="panel" style={{ padding: 14, width: 880 }}>
          <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden' }}>
            <img src="/assets/screenshot.jpg" style={{ width: '100%', display: 'block' }} />
            {/* scanning line */}
            {t < 3.4 && (
              <motion.div
                style={{ position: 'absolute', left: 0, right: 0, height: 120, background: 'linear-gradient(180deg, transparent, rgba(34,211,238,.35), transparent)', borderBottom: '2px solid var(--cyan)' }}
                initial={{ top: '-15%' }}
                animate={{ top: '100%' }}
                transition={{ duration: 1.4, repeat: 1, ease: 'linear', delay: 0.5 }}
              />
            )}
            {/* column projection */}
            {COLS.map((c, k) =>
              t > 3.2 + k * 0.35 ? (
                <motion.div
                  key={c.label}
                  initial={{ opacity: 0, scaleY: 0 }}
                  animate={{ opacity: 1, scaleY: 1 }}
                  transition={{ duration: 0.4, ease }}
                  style={{ position: 'absolute', left: `${c.left}%`, width: `${c.width}%`, top: '36.6%', height: '9.2%', border: `2px solid ${c.color}`, background: c.color + '22', borderRadius: 6, boxShadow: `0 0 24px ${c.color}88` }}
                >
                  <span style={{ position: 'absolute', top: -30, left: 0, fontSize: 15, fontWeight: 800, color: '#021018', background: c.color, padding: '2px 8px', borderRadius: 5, whiteSpace: 'nowrap' }}>{c.label}</span>
                </motion.div>
              ) : null,
            )}
          </div>
          <div className="row muted" style={{ justifyContent: 'space-between', padding: '14px 8px 4px', fontSize: 18 }}>
            <span>📸 Captura real do FiveM (dataset do projeto)</span>
            <span className="mono cyan">projeção geométrica espacial</span>
          </div>
        </Appear>

        {/* Pipeline steps */}
        <div className="col" style={{ flex: 1, gap: 16 }}>
          {STEPS.map((s, k) => {
            const active = activeStep === k;
            const done = activeStep > k;
            return (
              <Appear key={s.title} delay={0.5 + k * 0.12} x={40}>
                <motion.div
                  className="panel row"
                  animate={{
                    borderColor: active ? 'rgba(34,211,238,.9)' : done ? 'rgba(34,197,94,.45)' : 'rgba(34,211,238,.18)',
                    scale: active ? 1.03 : 1,
                    boxShadow: active ? '0 0 40px rgba(34,211,238,.35)' : '0 20px 50px rgba(0,0,0,.4)',
                  }}
                  style={{ padding: '18px 24px', gap: 20 }}
                >
                  <span style={{ fontSize: 36 }}>{s.icon}</span>
                  <div className="col" style={{ flex: 1 }}>
                    <span style={{ fontSize: 26, fontWeight: 800 }}>{s.title}</span>
                    <span className="muted mono" style={{ fontSize: 17, marginTop: 4 }}>{s.desc}</span>
                  </div>
                  <span style={{ fontSize: 26 }} className={done ? 'green' : 'muted'}>{done ? '✓' : active ? '⟳' : '•'}</span>
                </motion.div>
              </Appear>
            );
          })}

          {t > 7.2 && (
            <Appear y={20} className="row" style={{ gap: 20, alignItems: 'stretch' }}>
              <div className="code" style={{ flex: 1, color: 'var(--green)', fontSize: 21 }}>
                <Typer text={json} t={t} start={7.4} cps={45} />
              </div>
              {t > 9.2 && (
                <Appear scale={0.7} y={0} className="col panel" style={{ justifyContent: 'center', alignItems: 'center', padding: 24, borderColor: 'rgba(34,197,94,.5)' }}>
                  <span className="mono green" style={{ fontSize: 50, fontWeight: 800 }}>1,2s</span>
                  <span className="muted" style={{ fontSize: 17, textAlign: 'center' }}>copiado para<br />o clipboard</span>
                </Appear>
              )}
            </Appear>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 * 04 — Hedged Racing + fallback offline
 * ============================================================ */
function Lane({ name, sub, p, state, color }: { name: string; sub: string; p: number; state: 'run' | 'win' | 'abort'; color: string }) {
  const c = state === 'abort' ? 'var(--red)' : state === 'win' ? 'var(--green)' : color;
  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span style={{ fontSize: 24, fontWeight: 700, textDecoration: state === 'abort' ? 'line-through' : undefined, color: state === 'abort' ? 'var(--red)' : undefined }}>
          {name} <span className="muted" style={{ fontSize: 18, fontWeight: 500 }}>{sub}</span>
        </span>
        <span className="mono" style={{ fontSize: 20, fontWeight: 700, color: c }}>
          {state === 'win' ? '✓ venceu · 1,1s' : state === 'abort' ? '✕ AbortController.abort()' : `${Math.round(p * 100)}%`}
        </span>
      </div>
      <div className="bar-track" style={{ height: 22 }}>
        <motion.div className="bar-fill" style={{ width: `${p * 100}%`, background: c, boxShadow: `0 0 20px ${c}` }} />
      </div>
    </div>
  );
}

export function Hedged() {
  const t = useElapsed();
  const WIN = 3.4;
  const pA = Math.min(prog(t, 0.6, 7) * 0.9, t > WIN ? prog(WIN, 0.6, 7) * 0.9 : 1);
  const pB = t < 1.2 ? 0 : Math.min((t - 1.2) / (WIN - 1.2), 1);
  const key = Math.floor(t / 0.9) % 3;
  const chain = [
    { name: 'gemini-2.5-flash-lite', tag: 'principal', color: 'var(--cyan)' },
    { name: 'gemini-3.1-flash-lite', tag: 'fallback', color: 'var(--purple)' },
    { name: 'Tesseract.js Worker', tag: '100% offline', color: 'var(--gold)' },
  ];
  return (
    <div className="scene">
      <Header num="04" kicker="Velocidade & resiliência" title={<>Hedged Racing: <span className="grad">a resposta mais rápida vence</span></>} lead="Uma segunda requisição especulativa é disparada se a primeira atrasar — a mais lenta é cancelada na hora." />

      <Appear delay={0.4} className="panel col" style={{ padding: 40, gap: 30, marginTop: 40 }}>
        <Lane name="Requisição A" sub="· original" p={pA} state={t > WIN ? 'abort' : 'run'} color="var(--cyan)" />
        <Lane name="Requisição B" sub="· especulativa (+delay)" p={pB} state={t > WIN ? 'win' : 'run'} color="var(--gold)" />
      </Appear>

      <div className="row" style={{ gap: 40, marginTop: 36, alignItems: 'stretch' }}>
        <Appear delay={1} className="panel col" style={{ flex: 1, padding: 32, gap: 20 }}>
          <span style={{ fontSize: 24, fontWeight: 800 }}>🔑 Rotação balanceada de chaves</span>
          <div className="row" style={{ gap: 16 }}>
            {[1, 2, 3].map((n, k) => (
              <motion.div
                key={n}
                className="mono"
                animate={{ background: key === k ? 'rgba(251,191,36,.18)' : 'rgba(255,255,255,.04)', borderColor: key === k ? '#fbbf24' : 'rgba(255,255,255,.1)', scale: key === k ? 1.08 : 1 }}
                style={{ flex: 1, textAlign: 'center', padding: '16px 0', borderRadius: 12, border: '2px solid', fontSize: 20, fontWeight: 700 }}
              >
                API KEY #{n}
              </motion.div>
            ))}
          </div>
          <div className="code" style={{ fontSize: 18 }}>
            <span className="purple">keyRotationIndex</span> = (<span className="purple">keyRotationIndex</span> + <span className="gold">1</span>) % keys.length;
          </div>
        </Appear>

        <Appear delay={1.3} className="panel col" style={{ flex: 1.25, padding: 32, gap: 20 }}>
          <span style={{ fontSize: 24, fontWeight: 800 }}>🛟 Cadeia de contingência</span>
          <div className="row" style={{ gap: 12 }}>
            {chain.map((c, k) => (
              <div key={c.name} className="row" style={{ gap: 12, flex: 1 }}>
                {t > 4 + k * 0.6 && (
                  <motion.div initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ ease, duration: 0.5 }} className="col" style={{ flex: 1, padding: '14px 12px', borderRadius: 12, border: `2px solid ${c.color}`, background: 'rgba(0,0,0,.3)' }}>
                    <span className="mono" style={{ fontSize: 16, fontWeight: 700, color: c.color }}>{c.name}</span>
                    <span className="muted" style={{ fontSize: 15 }}>{c.tag}</span>
                  </motion.div>
                )}
                {k < chain.length - 1 && t > 4.3 + k * 0.6 && <span style={{ fontSize: 26 }} className="muted">→</span>}
              </div>
            ))}
          </div>
          {t > 6 && (
            <Appear y={14} className="row" style={{ gap: 14 }}>
              <div className="chip" style={{ fontSize: 17 }}>① Projeção geométrica por âncoras</div>
              <div className="chip" style={{ fontSize: 17 }}>② Otsu + nitidez se confiança &lt; 70%</div>
            </Appear>
          )}
        </Appear>
      </div>
    </div>
  );
}
