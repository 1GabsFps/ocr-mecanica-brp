import { motion } from 'framer-motion';
import { Appear, Count, Header, ease, prog, useElapsed } from '../common';

/* ============================================================
 * 05 — Frontend SPA
 * ============================================================ */
const PARTS = [
  { n: 'Kit Reparo', p: 1500 },
  { n: 'Pneus', p: 800 },
  { n: 'Motor', p: 4200 },
  { n: 'Turbo', p: 6500 },
  { n: 'Suspensão', p: 2100 },
  { n: 'Pintura', p: 1200 },
];
const SHORTCUTS = [
  { keys: ['Ctrl', 'V'], label: 'Cola o print do jogo' },
  { keys: ['Ctrl', 'Enter'], label: 'Envia ao Discord e copia a ficha' },
  { keys: ['Ctrl', 'H'], label: 'Abre o histórico de ordens' },
  { keys: ['Esc'], label: 'Limpa para novo atendimento' },
];

export function Frontend() {
  const t = useElapsed();
  const tabs = ['Fichas', 'Ponto', 'Baú', 'Admin'];
  const tab = t < 7.5 ? 0 : Math.min(3, Math.floor((t - 7.5) / 0.6) + 1);
  const dropped = t > 1.6;
  const ocrP = prog(t, 1.8, 1.3);
  const result = t > 3.2;
  const selected = PARTS.map((_, k) => t > 4 + [0, 0.4, 99, 0.8, 1.2, 99][k]);
  const total = PARTS.reduce((s, p, k) => s + (selected[k] ? p.p : 0), 0);
  const sc = Math.floor((t - 2) / 1.4);
  return (
    <div className="scene">
      <Header num="05" kicker="Interface Web · PWA" title={<>Feita para <span className="grad">operar sem tirar a mão do teclado</span></>} />

      <div className="row" style={{ gap: 44, marginTop: 40, alignItems: 'flex-start' }}>
        {/* App mock */}
        <Appear delay={0.3} y={50} className="panel" style={{ width: 1120, overflow: 'hidden' }}>
          <div className="row" style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', gap: 14 }}>
            <img src="/assets/logo.png" style={{ width: 38, height: 38, clipPath: 'circle(44%)' }} />
            <b style={{ fontSize: 22 }}>Mecânica BRP</b>
            <span className="row muted" style={{ gap: 8, fontSize: 16, marginLeft: 10 }}>
              <motion.span className="dot" style={{ background: 'var(--green)' }} animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 1.4 }} /> online
            </span>
            <div className="row" style={{ marginLeft: 'auto', gap: 6 }}>
              {tabs.map((tb, k) => (
                <div key={tb} style={{ position: 'relative', padding: '10px 20px', fontSize: 18, fontWeight: 700, color: tab === k ? '#fff' : 'var(--muted)' }}>
                  {tab === k && <motion.div layoutId="tab" style={{ position: 'absolute', inset: 0, borderRadius: 10, background: 'rgba(34,211,238,.15)', border: '1px solid rgba(34,211,238,.5)' }} />}
                  <span style={{ position: 'relative' }}>{tb}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="row" style={{ padding: 24, gap: 24, alignItems: 'stretch' }}>
            <div className="col" style={{ flex: 1, gap: 18 }}>
              {/* DropZone */}
              <div style={{ height: 190, borderRadius: 16, border: '2px dashed rgba(34,211,238,.4)', display: 'grid', placeItems: 'center', position: 'relative', overflow: 'hidden', background: 'rgba(34,211,238,.03)' }}>
                {!dropped ? (
                  <span className="muted" style={{ fontSize: 20 }}>📋 Arraste, clique ou <b className="cyan">Ctrl+V</b></span>
                ) : (
                  <motion.img src="/assets/crop.png" initial={{ scale: 1.6, opacity: 0, y: -60 }} animate={{ scale: 1, opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 120, damping: 14 }} style={{ width: '94%', borderRadius: 8 }} />
                )}
              </div>
              {/* progress */}
              <div className="col" style={{ gap: 8 }}>
                <div className="row muted" style={{ justifyContent: 'space-between', fontSize: 15 }}>
                  <span>OcrProgressBar</span>
                  <span className="mono">{Math.round(ocrP * 100)}%</span>
                </div>
                <div className="bar-track"><div className="bar-fill" style={{ width: `${ocrP * 100}%`, background: 'linear-gradient(90deg,var(--cyan),var(--gold))' }} /></div>
              </div>
              {/* result */}
              <div className="row" style={{ gap: 12 }}>
                {[
                  ['Placa', 'XMN 0797'],
                  ['Proprietário', 'Riba Mar'],
                  ['Modelo', 'R 730 4x2'],
                ].map(([l, v], k) => (
                  <div className="field" key={l} style={{ flex: 1 }}>
                    <label>{l}</label>
                    <div className="input" style={{ fontSize: 20, height: 52 }}>
                      {result && <motion.span initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: k * 0.1 }}>{v}</motion.span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="col" style={{ width: 380, gap: 18 }}>
              <div className="panel" style={{ padding: 18, background: 'var(--panel-2)' }}>
                <span className="muted" style={{ fontSize: 15, fontWeight: 700, letterSpacing: '.12em' }}>ATENDIMENTOS HOJE</span>
                <div className="mono gold" style={{ fontSize: 52, fontWeight: 800 }}><Count t={t} start={0.6} dur={2.4} to={47} /></div>
              </div>
              <div className="panel" style={{ padding: 18, background: 'var(--panel-2)', flex: 1 }}>
                <span className="muted" style={{ fontSize: 15, fontWeight: 700, letterSpacing: '.12em' }}>PEÇAS & SERVIÇOS</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
                  {PARTS.map((p, k) => (
                    <motion.div key={p.n} animate={{ background: selected[k] ? 'rgba(251,191,36,.18)' : 'rgba(255,255,255,.04)', borderColor: selected[k] ? '#fbbf24' : 'rgba(255,255,255,.08)' }} style={{ border: '1px solid', borderRadius: 10, padding: '8px 10px', fontSize: 16, fontWeight: 600 }}>
                      {selected[k] ? '✓ ' : ''}{p.n}
                    </motion.div>
                  ))}
                </div>
                <div className="row" style={{ justifyContent: 'space-between', marginTop: 14, fontSize: 20, fontWeight: 800 }}>
                  <span>Total</span>
                  <span className="mono green">R$ {total.toLocaleString('pt-BR')}</span>
                </div>
              </div>
            </div>
          </div>
        </Appear>

        {/* Shortcuts */}
        <div className="col" style={{ flex: 1, gap: 18 }}>
          {SHORTCUTS.map((s, k) => (
            <Appear key={s.label} delay={0.6 + k * 0.15} x={40}>
              <motion.div className="panel row" animate={{ borderColor: sc === k ? 'rgba(251,191,36,.9)' : 'rgba(34,211,238,.18)', scale: sc === k ? 1.04 : 1 }} style={{ padding: '18px 22px', gap: 16 }}>
                <div className="row" style={{ gap: 6, minWidth: 190 }}>
                  {s.keys.map((kk, i) => (
                    <span key={kk} className="row" style={{ gap: 6 }}>
                      {i > 0 && <span className="muted">+</span>}
                      <span className="key">{kk}</span>
                    </span>
                  ))}
                </div>
                <span style={{ fontSize: 20, fontWeight: 600 }}>{s.label}</span>
              </motion.div>
            </Appear>
          ))}
          <Appear delay={1.6} className="chip-row" style={{ justifyContent: 'flex-start', marginTop: 10 }}>
            {['React 19', 'Vite', 'TypeScript', 'Tailwind', 'ErrorBoundary', 'Auto-update seguro'].map((c) => (
              <span key={c} className="chip" style={{ fontSize: 17 }}>{c}</span>
            ))}
          </Appear>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 * 06 — Módulos de negócio
 * ============================================================ */
function ModCard({ icon, title, path, delay, children, color }: { icon: string; title: string; path: string; delay: number; children: React.ReactNode; color: string }) {
  return (
    <Appear delay={delay} y={60} className="panel col" style={{ padding: 26, gap: 16, height: 640, borderTop: `4px solid ${color}` }}>
      <span style={{ fontSize: 46 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 27, fontWeight: 800, lineHeight: 1.15 }}>{title}</div>
        <div className="mono muted" style={{ fontSize: 15, marginTop: 6 }}>{path}</div>
      </div>
      <div className="col" style={{ gap: 12, marginTop: 6, flex: 1 }}>{children}</div>
    </Appear>
  );
}

export function Modules() {
  const t = useElapsed();
  const shifts = [
    { n: 'Matutino', h: '06–12h', v: 0.72 },
    { n: 'Vespertino', h: '12–18h', v: 0.95 },
    { n: 'Noturno', h: '18–00h', v: 0.84 },
    { n: 'Madrugada', h: '00–06h', v: 0.38 },
  ];
  const stock = [
    { n: 'Kit Reparo', cur: 34, meta: 40 },
    { n: 'Pneus', cur: 52, meta: 40 },
    { n: 'Tintas', cur: 12, meta: 30 },
    { n: 'Peças Motor', cur: 22, meta: 25 },
  ];
  const ranking = [
    { n: 'R. Santos', c: 31, f: 12 },
    { n: 'L. Ferreira', c: 26, f: 9 },
    { n: 'M. Douglas', c: 19, f: 11 },
    { n: 'T. Alves', c: 15, f: 4 },
  ];
  const roles = [
    { n: 'Dono / Diretor', c: '#fbbf24' },
    { n: 'Gerente', c: '#f97316' },
    { n: 'Supervisor', c: '#a78bfa' },
    { n: 'Profissional', c: '#22d3ee' },
    { n: 'Auxiliar', c: '#22c55e' },
    { n: 'Aprendiz', c: '#94a3b8' },
  ];
  const fat = [
    { n: 'Guincho Fora', v: 3500 },
    { n: 'Turbo + Roda', v: 8700 },
    { n: 'Kit Reparo x2', v: 3000 },
  ];
  return (
    <div className="scene">
      <Header num="06" kicker="Módulos de negócio" title={<>Muito além da placa: <span className="grad">a oficina inteira</span></>} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 24, marginTop: 40 }}>
        <ModCard icon="⏱️" title="Ponto Eletrônico" path="workHours/" delay={0.3} color="#22d3ee">
          {shifts.map((s, k) => (
            <div key={s.n} className="col" style={{ gap: 6 }}>
              <div className="row" style={{ justifyContent: 'space-between', fontSize: 17 }}>
                <b>{s.n}</b><span className="muted mono">{s.h}</span>
              </div>
              <div className="bar-track"><div className="bar-fill" style={{ width: `${prog(t, 1 + k * 0.15, 1.2) * s.v * 100}%`, background: 'var(--cyan)' }} /></div>
            </div>
          ))}
          <div className="muted" style={{ fontSize: 16, marginTop: 'auto' }}>Ciclos quinzenais, cartão de ponto individual e ranking de horas.</div>
        </ModCard>

        <ModCard icon="📦" title="Baú & Estoque" path="inventory/" delay={0.45} color="#fbbf24">
          {stock.map((s, k) => {
            const low = s.cur < s.meta;
            return (
              <div key={s.n} className="col" style={{ gap: 6 }}>
                <div className="row" style={{ justifyContent: 'space-between', fontSize: 17 }}>
                  <b>{s.n}</b><span className={`mono ${low ? 'red' : 'green'}`}>{s.cur}/{s.meta}</span>
                </div>
                <div className="bar-track" style={{ overflow: 'visible' }}>
                  <div className="bar-fill" style={{ width: `${prog(t, 1.2 + k * 0.15, 1.2) * Math.min(1, s.cur / 60) * 100}%`, background: low ? 'var(--red)' : 'var(--green)' }} />
                  <div style={{ position: 'absolute', left: `${(s.meta / 60) * 100}%`, top: -4, bottom: -4, width: 3, background: '#fff', borderRadius: 2 }} />
                </div>
              </div>
            );
          })}
          {t > 3 && (
            <Appear y={10} className="code" style={{ fontSize: 15, padding: '12px 14px', marginTop: 'auto', whiteSpace: 'normal' }}>
              🛒 comprar = <span className="gold">max</span>(0, meta − atual)<br />
              <span className="red">Tintas +18 · Kit +6 · Motor +3</span>
            </Appear>
          )}
        </ModCard>

        <ModCard icon="🚛" title="Ranking de Guincho" path="GuinchoRankingDashboard" delay={0.6} color="#f97316">
          {ranking.map((r, k) => (
            <motion.div key={r.n} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.4 + k * 0.15 }} className="col" style={{ gap: 6 }}>
              <div className="row" style={{ justifyContent: 'space-between', fontSize: 17 }}>
                <b>{['🥇', '🥈', '🥉', '4º'][k]} {r.n}</b><span className="mono gold">{r.c + r.f * 2} pts</span>
              </div>
              <div className="row" style={{ gap: 3, height: 12 }}>
                <div className="bar-fill" style={{ width: `${prog(t, 1.6 + k * 0.15, 1) * r.c * 2.2}%`, background: 'var(--orange)' }} />
                <div className="bar-fill" style={{ width: `${prog(t, 1.6 + k * 0.15, 1) * r.f * 2.2 * 2}%`, background: 'var(--purple)' }} />
              </div>
            </motion.div>
          ))}
          <div className="row muted" style={{ gap: 14, fontSize: 15, marginTop: 'auto' }}>
            <span><span className="dot" style={{ background: 'var(--orange)' }} /> Cidade</span>
            <span><span className="dot" style={{ background: 'var(--purple)' }} /> Fora (Sandy/Paleto)</span>
          </div>
        </ModCard>

        <ModCard icon="🏛️" title="Hierarquia de Cargos" path="hierarchy/" delay={0.75} color="#a78bfa">
          {roles.map((r, k) => (
            <motion.div key={r.n} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.5 + k * 0.12, ease }} className="row" style={{ gap: 10, padding: '9px 12px', borderRadius: 10, background: r.c + '18', border: `1px solid ${r.c}55`, marginLeft: k * 8 }}>
              <span className="dot" style={{ background: r.c }} />
              <span style={{ fontSize: 17, fontWeight: 700 }}>{r.n}</span>
            </motion.div>
          ))}
          <div className="muted" style={{ fontSize: 15, marginTop: 'auto' }}>Cargo detectado por regex no nickname do Discord.</div>
        </ModCard>

        <ModCard icon="🧾" title="Faturas & Ordens" path="faturasService.ts" delay={0.9} color="#22c55e">
          {fat.map((f, k) => (
            <motion.div key={f.n} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.8 + k * 0.25 }} className="row" style={{ justifyContent: 'space-between', fontSize: 18, padding: '10px 0', borderBottom: '1px dashed rgba(255,255,255,.12)' }}>
              <span>{f.n}</span><span className="mono">R$ {f.v.toLocaleString('pt-BR')}</span>
            </motion.div>
          ))}
          <div className="row" style={{ justifyContent: 'space-between', fontSize: 22, fontWeight: 800, marginTop: 6 }}>
            <span>Total</span>
            <span className="mono green"><Count t={t} start={2.6} dur={1.4} to={15200} prefix="R$ " /></span>
          </div>
          <div className="muted" style={{ fontSize: 15, marginTop: 'auto' }}>Cliente, mecânico, itens e horário de Brasília (UTC-3).</div>
        </ModCard>
      </div>
    </div>
  );
}

/* ============================================================
 * 07 — Discord Gateway
 * ============================================================ */
const OPS = [
  { op: '10', name: 'HELLO', desc: 'heartbeat_interval ≈ 41s', dir: '←' },
  { op: '2', name: 'IDENTIFY', desc: 'token + propriedades', dir: '→' },
  { op: '0', name: 'READY', desc: 'túnel aberto, VPS aguarda', dir: '←' },
  { op: '1/11', name: 'HEARTBEAT', desc: 'ping/ACK em segundo plano', dir: '⇄' },
  { op: '0', name: 'MESSAGE_CREATE', desc: 'push instantâneo → SQLite', dir: '←' },
];
const MSGS = [
  { ch: '#ponto', txt: '🟢 Iniciando Ponto — R. Santos' },
  { ch: '#baú', txt: '📦 Retirou 5x Kit Reparo' },
  { ch: '#faturas', txt: '🧾 Fatura #1284 · R$ 3.500' },
];

export function DiscordGateway() {
  const t = useElapsed();
  return (
    <div className="scene">
      <Header num="07" kicker="Tempo real 24/7" title={<>Discord Gateway: <span style={{ color: '#7983f5' }}>push</span>, não polling</>} lead={<span className="mono" style={{ fontSize: 22 }}>wss://gateway.discord.gg/?v=9&amp;encoding=json</span>} />

      <div className="row" style={{ gap: 40, marginTop: 36, alignItems: 'stretch' }}>
        <div className="col" style={{ width: 760, gap: 24 }}>
          {/* Polling */}
          <Appear delay={0.3} className="panel" style={{ padding: 26, borderColor: 'rgba(239,68,68,.4)' }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <b style={{ fontSize: 24 }}>HTTP Polling</b>
              <span className="mono red" style={{ fontSize: 18 }}>1000–3000 ms</span>
            </div>
            <div style={{ position: 'relative', height: 70, marginTop: 14, overflow: 'hidden' }}>
              {[0, 1, 2, 3, 4, 5].map((k) => (
                <motion.span key={k} className="mono badge" style={{ position: 'absolute', top: 18, whiteSpace: 'nowrap', background: 'rgba(239,68,68,.15)', color: 'var(--red)' }} initial={{ left: -200 }} animate={{ left: 760 }} transition={{ duration: 2.4, delay: k * 0.4, repeat: Infinity, ease: 'linear' }}>
                  GET /messages
                </motion.span>
              ))}
            </div>
            {t > 2.4 && (
              <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: [0, 1, 1], scale: 1 }} className="badge" style={{ background: 'var(--red)', color: '#fff' }}>
                HTTP 429 · Too Many Requests
              </motion.div>
            )}
          </Appear>
          {/* WebSocket */}
          <Appear delay={0.6} className="panel" style={{ padding: 26, borderColor: 'rgba(34,197,94,.5)' }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <b style={{ fontSize: 24 }}>WebSocket Gateway</b>
              <span className="mono green" style={{ fontSize: 18 }}>10–30 ms</span>
            </div>
            <div className="row" style={{ marginTop: 18, gap: 14 }}>
              <span className="badge" style={{ background: 'rgba(88,101,242,.2)', color: '#aab1ff' }}>Discord</span>
              <div style={{ flex: 1, height: 10, borderRadius: 10, background: 'rgba(34,197,94,.15)', position: 'relative', overflow: 'hidden' }}>
                <motion.div style={{ position: 'absolute', top: 0, bottom: 0, width: 80, borderRadius: 10, background: 'var(--green)', boxShadow: '0 0 20px var(--green)' }} initial={{ left: '-15%' }} animate={{ left: '100%' }} transition={{ duration: 1.1, repeat: Infinity, repeatDelay: 0.6, ease: 'easeIn' }} />
              </div>
              <span className="badge" style={{ background: 'rgba(34,211,238,.15)', color: 'var(--cyan)' }}>VPS</span>
            </div>
            <div className="row" style={{ gap: 12, marginTop: 18, flexWrap: 'wrap' }}>
              <span className="chip" style={{ fontSize: 16 }}>0 rate limit</span>
              <span className="chip" style={{ fontSize: 16 }}>40 bytes / 41 s</span>
              <span className="chip" style={{ fontSize: 16 }}>dedupe O(1) · 20.000 IDs</span>
            </div>
          </Appear>
        </div>

        <div className="col" style={{ flex: 1, gap: 12 }}>
          {OPS.map((o, k) => (
            <Appear key={o.name + k} delay={1 + k * 0.45} x={40} className="panel row" style={{ padding: '14px 22px', gap: 18 }}>
              <span className="mono" style={{ minWidth: 92, fontSize: 18, color: 'var(--gold)', fontWeight: 700 }}>op {o.op}</span>
              <span className="mono" style={{ fontSize: 22, color: '#aab1ff', fontWeight: 700, minWidth: 250 }}>{o.name}</span>
              <span className="muted" style={{ fontSize: 18, flex: 1 }}>{o.desc}</span>
              <span style={{ fontSize: 24 }}>{o.dir}</span>
            </Appear>
          ))}
          <div className="col" style={{ gap: 10, marginTop: 10 }}>
            {MSGS.map((m, k) =>
              t > 4.2 + k * 0.7 ? (
                <motion.div key={m.ch} initial={{ opacity: 0, x: -60, scale: 0.9 }} animate={{ opacity: 1, x: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 160, damping: 16 }} className="row" style={{ gap: 14, padding: '12px 18px', borderRadius: 12, background: 'rgba(88,101,242,.12)', border: '1px solid rgba(88,101,242,.35)' }}>
                  <span className="mono" style={{ color: '#aab1ff', fontSize: 17, minWidth: 100 }}>{m.ch}</span>
                  <span style={{ fontSize: 19, flex: 1 }}>{m.txt}</span>
                  <span className="mono green" style={{ fontSize: 16 }}>→ telemetry.db</span>
                </motion.div>
              ) : null,
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
