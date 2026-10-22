import { motion } from 'framer-motion';
import { Appear, Count, Header, Typer, ease, prog, useElapsed } from '../common';

/* ============================================================
 * 01 — Abertura / Hero
 * ============================================================ */
export function IntroScene() {
  const t = useElapsed();
  const pills = ['⚡ 100% WebAssembly Local', '🛡️ Zero Custo de Nuvem', '📡 Tempo Real 24/7'];

  return (
    <div className="center-col" style={{ height: '100%', gap: 36, position: 'relative' }}>
      <motion.div
        style={{ position: 'relative', width: 220, height: 220 }}
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 90, damping: 15 }}
      >
        <motion.div
          style={{ position: 'absolute', inset: -18, borderRadius: '50%', border: '1.5px solid rgba(56, 189, 248, 0.4)' }}
          animate={{ scale: [1, 1.28], opacity: [0.6, 0] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: 'easeOut' }}
        />
        <motion.div
          style={{ position: 'absolute', inset: -36, borderRadius: '50%', border: '1px solid rgba(52, 211, 153, 0.25)' }}
          animate={{ scale: [1, 1.35], opacity: [0.4, 0] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: 'easeOut', delay: 0.7 }}
        />
        <img
          src="/assets/logo.png"
          style={{ width: '100%', height: '100%', clipPath: 'circle(46%)', filter: 'drop-shadow(0 0 50px rgba(56, 189, 248, 0.45))' }}
          alt="Mecânica BRP Logo"
        />
      </motion.div>

      <div className="col" style={{ gap: 14, alignItems: 'center' }}>
        <Appear delay={0.3} y={15}>
          <div className="pill pill-cyan" style={{ fontSize: 13, letterSpacing: '0.14em', padding: '6px 18px' }}>
            FIVEM ROLEPLAY · TECNOLOGIA PARA OFICINAS
          </div>
        </Appear>

        <motion.h1
          className="grad-text"
          style={{ fontSize: 96, fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1 }}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8, ease }}
        >
          MECÂNICA BRP
        </motion.h1>

        <Appear delay={0.7} y={20}>
          <p style={{ fontSize: 26, color: 'var(--muted)', fontWeight: 400, maxWidth: 900, textAlign: 'center', lineHeight: 1.4 }}>
            OCR inteligente <span className="cyan">direto no navegador</span> e gestão operacional em tempo real.
          </p>
        </Appear>
      </div>

      <div className="row" style={{ gap: 16 }}>
        {pills.map((p, k) => (
          <Appear key={p} delay={1.1 + k * 0.15} y={15}>
            <div className="pill" style={{ fontSize: 16, padding: '10px 22px' }}>
              {p}
            </div>
          </Appear>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
 * 02 — O Salto de Produtividade (Problema vs Solução)
 * ============================================================ */
export function ProblemSolutionScene() {
  const t = useElapsed();
  const filled = t > 3.6;

  return (
    <div className="scene">
      <Header
        num="01"
        kicker="Produtividade Operacional"
        title={<>De <span className="red">45 segundos</span> para <span className="grad-cyan">1,2 segundo</span></>}
        lead="Elimine a digitação manual de fichas e erros de cadastro com um único atalho."
      />

      <div className="row" style={{ gap: 48, marginTop: 44, alignItems: 'stretch' }}>
        {/* Card Antes */}
        <Appear delay={0.3} x={-30} style={{ flex: 1, display: 'flex' }}>
          <div className="panel col" style={{ flex: 1, padding: 44, gap: 24, borderColor: 'rgba(248, 113, 113, 0.25)' }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div className="col" style={{ gap: 4 }}>
                <span style={{ fontSize: 24, fontWeight: 700 }}>Digitação Manual</span>
                <span className="muted" style={{ fontSize: 16 }}>Lenta e sujeita a erros</span>
              </div>
              <span className="mono red" style={{ fontSize: 44, fontWeight: 800 }}>
                <Count t={t} start={0.4} dur={5} to={45} suffix="s" />
              </span>
            </div>

            <div className="col" style={{ gap: 16, marginTop: 8 }}>
              <div className="field">
                <label>Placa</label>
                <div className="input" style={{ color: t > 2 ? 'var(--red)' : undefined, textDecoration: t > 2 ? 'line-through' : undefined }}>
                  <Typer text="WXW 2346" t={t} start={0.6} cps={6} />
                </div>
              </div>
              <div className="field">
                <label>Proprietário</label>
                <div className="input"><Typer text="Maicon Duglas..." t={t} start={2.2} cps={5} /></div>
              </div>
            </div>

            {t > 2.2 && (
              <Appear y={10} className="pill" style={{ background: 'rgba(248, 113, 113, 0.1)', color: 'var(--red)', alignSelf: 'flex-start', border: '1px solid rgba(248, 113, 113, 0.2)' }}>
                ⚠ Caractere incorreto detectado
              </Appear>
            )}
          </div>
        </Appear>

        {/* Card Depois */}
        <Appear delay={0.5} x={30} style={{ flex: 1, display: 'flex' }}>
          <div className="panel col" style={{ flex: 1, padding: 44, gap: 24, borderColor: filled ? 'rgba(52, 211, 153, 0.4)' : 'var(--border)' }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div className="col" style={{ gap: 4 }}>
                <span style={{ fontSize: 24, fontWeight: 700 }}>Mecânica BRP</span>
                <span className="cyan" style={{ fontSize: 16 }}>Reconhecimento instantâneo</span>
              </div>
              <span className="mono emerald" style={{ fontSize: 44, fontWeight: 800 }}>
                {filled ? '1,2s' : '—'}
              </span>
            </div>

            <div className="row" style={{ gap: 12, alignItems: 'center' }}>
              <motion.span className="key" animate={t > 2.8 && t < 3.3 ? { y: 3, borderBottomWidth: 1 } : { y: 0 }}>Ctrl</motion.span>
              <span style={{ fontSize: 22, color: 'var(--subtle)' }}>+</span>
              <motion.span className="key" animate={t > 2.9 && t < 3.3 ? { y: 3, borderBottomWidth: 1 } : { y: 0 }}>V</motion.span>
              <span className="muted" style={{ fontSize: 18, marginLeft: 10 }}>cola a captura de tela do jogo</span>
            </div>

            <div className="col" style={{ gap: 14 }}>
              {[
                ['Placa', 'WWX 2364'],
                ['Proprietário', 'Maicon Douglas'],
              ].map(([lbl, val], k) => (
                <div className="field" key={lbl}>
                  <label>{lbl}</label>
                  <div className="input" style={{ borderColor: filled ? 'rgba(52, 211, 153, 0.45)' : undefined }}>
                    {filled && (
                      <motion.span
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: k * 0.1 }}
                        style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}
                      >
                        {val} <span className="emerald">✓</span>
                      </motion.span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Appear>
      </div>

      {t > 4.5 && (
        <Appear y={20} style={{ marginTop: 'auto', textAlign: 'center' }}>
          <span style={{ fontSize: 32, fontWeight: 800 }}>
            <span className="grad-cyan">−97% de tempo</span> por atendimento veicular
          </span>
        </Appear>
      )}
    </div>
  );
}

/* ============================================================
 * 03 — Motor 100% Local no Navegador
 * ============================================================ */
export function LocalOcrScene() {
  const t = useElapsed();

  return (
    <div className="scene">
      <Header
        num="02"
        kicker="Arquitetura de Visão"
        title={<>OCR <span className="grad-cyan">100% Local</span> no Navegador</>}
        lead="Processamento em WebAssembly client-side. Zero custos de API, zero dependência de nuvem."
      />

      <div className="row" style={{ gap: 48, marginTop: 40, alignItems: 'center' }}>
        {/* Captura com escaneamento */}
        <Appear delay={0.3} x={-40} className="panel" style={{ width: 880, padding: 14, overflow: 'hidden' }}>
          <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden' }}>
            <img src="/assets/screenshot.jpg" style={{ width: '100%', display: 'block' }} alt="Captura FiveM" />

            {/* Laser scanning */}
            {t < 3.8 && (
              <motion.div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  height: 90,
                  background: 'linear-gradient(180deg, transparent, rgba(56, 189, 248, 0.35), transparent)',
                  borderBottom: '2px solid var(--cyan)',
                }}
                initial={{ top: '-10%' }}
                animate={{ top: '100%' }}
                transition={{ duration: 1.5, repeat: 1, ease: 'linear', delay: 0.4 }}
              />
            )}

            {/* Projeção de colunas */}
            {t > 2.8 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{
                  position: 'absolute',
                  left: '16%',
                  top: '36%',
                  width: '32%',
                  height: '11%',
                  border: '2px solid var(--cyan)',
                  borderRadius: 6,
                  background: 'rgba(56, 189, 248, 0.15)',
                  boxShadow: '0 0 24px rgba(56, 189, 248, 0.4)',
                }}
              >
                <span style={{ position: 'absolute', top: -26, left: 0, background: 'var(--cyan)', color: '#030712', fontSize: 13, fontWeight: 800, padding: '2px 8px', borderRadius: 4 }}>
                  ROI IDENTIFICADO
                </span>
              </motion.div>
            )}
          </div>
          <div className="row" style={{ justifyContent: 'space-between', padding: '14px 8px 4px', fontSize: 15, color: 'var(--muted)' }}>
            <span>HUD da oficina in-game (dataset real)</span>
            <span className="mono cyan">fatiamento geométrico das colunas</span>
          </div>
        </Appear>

        {/* Pilares do Motor Local */}
        <div className="col" style={{ flex: 1, gap: 20 }}>
          {[
            {
              title: 'Motor WebAssembly Local',
              desc: 'Executa diretamente no cliente via Web Worker. Não trava a interface do usuário.',
              tag: 'Zero Cloud',
            },
            {
              title: 'Projeção Espacial 2-Pass',
              desc: 'Identifica cabeçalhos e fatia as colunas sem misturar campos adjacentes.',
              tag: 'Precisão Alta',
            },
            {
              title: 'Sanitização via Regex',
              desc: 'Valida placas Mercosul, formata nomes em Title Case e padroniza modelos.',
              tag: 'Determinístico',
            },
          ].map((item, k) => (
            <Appear key={item.title} delay={0.5 + k * 0.18} x={30}>
              <div className="panel col" style={{ padding: '22px 26px', gap: 6 }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 20, fontWeight: 700 }}>{item.title}</span>
                  <span className="pill pill-cyan" style={{ fontSize: 13, padding: '4px 12px' }}>{item.tag}</span>
                </div>
                <span className="muted" style={{ fontSize: 16 }}>{item.desc}</span>
              </div>
            </Appear>
          ))}

          <Appear delay={1.2} y={15}>
            <div className="pill pill-emerald" style={{ alignSelf: 'flex-start', padding: '8px 18px', fontSize: 15 }}>
              🔒 100% Privado · Os prints nunca saem da máquina do mecânico
            </div>
          </Appear>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 * 04 — Interface Web & Ergonomia
 * ============================================================ */
export function InterfaceScene() {
  const t = useElapsed();
  const filled = t > 2.2;
  const parts = ['Troca de Óleo', 'Kit Reparo', 'Pneus', 'Freios'];
  const activeParts = [true, t > 3.2, false, t > 4.2];

  return (
    <div className="scene">
      <Header
        num="03"
        kicker="Design & Experiência"
        title={<>Operação sem tirar a <span className="grad-cyan">mão do teclado</span></>}
        lead="Interface moderna, minimalista e pensada para fluxo contínuo durante o atendimento."
      />

      <div className="row" style={{ gap: 48, marginTop: 40, alignItems: 'flex-start' }}>
        {/* Mockup do App */}
        <Appear delay={0.3} y={30} className="panel col" style={{ width: 1040, overflow: 'hidden' }}>
          {/* Top Bar */}
          <div className="row" style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', justifyContent: 'space-between' }}>
            <div className="row" style={{ gap: 12 }}>
              <img src="/assets/logo.png" style={{ width: 30, height: 30, clipPath: 'circle(46%)' }} alt="Logo" />
              <b style={{ fontSize: 18 }}>Mecânica BRP</b>
            </div>
            <div className="row" style={{ gap: 8, fontSize: 14, color: 'var(--muted)' }}>
              <span className="dot" style={{ background: 'var(--emerald)' }} /> online
            </div>
          </div>

          {/* Conteúdo do Formulário */}
          <div className="row" style={{ padding: 28, gap: 28, alignItems: 'stretch' }}>
            <div className="col" style={{ flex: 1, gap: 18 }}>
              {/* Dropzone */}
              <div style={{ height: 160, borderRadius: 12, border: '2px dashed rgba(56, 189, 248, 0.3)', display: 'grid', placeItems: 'center', background: 'rgba(56, 189, 248, 0.03)' }}>
                {!filled ? (
                  <span className="muted" style={{ fontSize: 17 }}>📋 Pressione <b className="cyan">Ctrl+V</b> para colar o print</span>
                ) : (
                  <motion.img src="/assets/crop.png" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} style={{ width: '90%', borderRadius: 6 }} alt="Preview" />
                )}
              </div>

              {/* Campos preenchidos */}
              <div className="row" style={{ gap: 12 }}>
                {[
                  ['Placa', 'XMN 0797'],
                  ['Proprietário', 'Riba Mar'],
                  ['Modelo', 'R 730 4x2'],
                ].map(([lbl, val], k) => (
                  <div className="field" key={lbl} style={{ flex: 1 }}>
                    <label>{lbl}</label>
                    <div className="input" style={{ height: 46, fontSize: 17 }}>
                      {filled && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: k * 0.1 }}>{val}</motion.span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Painel lateral de serviços */}
            <div className="panel col" style={{ width: 320, padding: 20, gap: 14, background: 'rgba(15, 23, 42, 0.5)' }}>
              <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--subtle)' }}>SERVIÇOS REALIZADOS</span>
              <div className="col" style={{ gap: 8 }}>
                {parts.map((p, k) => (
                  <div
                    key={p}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px solid',
                      borderColor: activeParts[k] ? 'rgba(56, 189, 248, 0.35)' : 'rgba(255, 255, 255, 0.06)',
                      background: activeParts[k] ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
                      fontSize: 14,
                      fontWeight: 600,
                      color: activeParts[k] ? '#fff' : 'var(--muted)',
                    }}
                  >
                    {activeParts[k] ? '✓ ' : '+ '}{p}
                  </div>
                ))}
              </div>
              <div className="row" style={{ justifyContent: 'space-between', marginTop: 'auto', paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                <span className="muted" style={{ fontSize: 16 }}>Total</span>
                <span className="mono emerald" style={{ fontSize: 20, fontWeight: 800 }}>R$ 4.200</span>
              </div>
            </div>
          </div>
        </Appear>

        {/* Atalhos de Teclado */}
        <div className="col" style={{ flex: 1, gap: 16 }}>
          {[
            { keys: ['Ctrl', 'V'], label: 'Cola o print do jogo' },
            { keys: ['Ctrl', 'Enter'], label: 'Envia a ficha ao Discord' },
            { keys: ['Esc'], label: 'Limpa para o próximo cliente' },
          ].map((s, k) => (
            <Appear key={s.label} delay={0.6 + k * 0.15} x={30}>
              <div className="panel row" style={{ padding: '18px 22px', gap: 18 }}>
                <div className="row" style={{ gap: 6, minWidth: 150 }}>
                  {s.keys.map((kk, i) => (
                    <span key={kk} className="row" style={{ gap: 6 }}>
                      {i > 0 && <span className="muted">+</span>}
                      <span className="key" style={{ minWidth: 46, height: 42, fontSize: 16 }}>{kk}</span>
                    </span>
                  ))}
                </div>
                <span style={{ fontSize: 17, fontWeight: 600 }}>{s.label}</span>
              </div>
            </Appear>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 * 05 — Módulos de Gestão (Bento Grid)
 * ============================================================ */
export function OperationsScene() {
  const t = useElapsed();

  return (
    <div className="scene">
      <Header
        num="04"
        kicker="Gestão Integrada"
        title={<>A oficina inteira em um <span className="grad-cyan">só lugar</span></>}
        lead="Muito além do OCR: controle de equipe, peças e finanças sincronizados."
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24, marginTop: 44, flex: 1 }}>
        {/* Card 1: Ponto */}
        <Appear delay={0.3} y={30} className="panel col" style={{ padding: 28, gap: 18 }}>
          <span style={{ fontSize: 36 }}>⏱️</span>
          <div className="col" style={{ gap: 4 }}>
            <b style={{ fontSize: 22 }}>Ponto Eletrônico</b>
            <span className="muted" style={{ fontSize: 14 }}>Escuta passiva de expediente</span>
          </div>
          <div className="col" style={{ gap: 10, marginTop: 6 }}>
            {['Matutino', 'Vespertino', 'Noturno', 'Madrugada'].map((s, k) => (
              <div key={s} className="col" style={{ gap: 4 }}>
                <div className="row" style={{ justifyContent: 'space-between', fontSize: 14 }}>
                  <span>{s}</span>
                  <span className="muted mono">{['72%', '95%', '84%', '38%'][k]}</span>
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${prog(t, 0.8 + k * 0.1, 1) * [72, 95, 84, 38][k]}%`, background: 'var(--cyan)' }} />
                </div>
              </div>
            ))}
          </div>
          <span className="muted" style={{ fontSize: 13, marginTop: 'auto' }}>Ciclos quinzenais automatizados</span>
        </Appear>

        {/* Card 2: Baú & Estoque */}
        <Appear delay={0.45} y={30} className="panel col" style={{ padding: 28, gap: 18 }}>
          <span style={{ fontSize: 36 }}>📦</span>
          <div className="col" style={{ gap: 4 }}>
            <b style={{ fontSize: 22 }}>Baú & Estoque</b>
            <span className="muted" style={{ fontSize: 14 }}>Controle rigoroso de peças</span>
          </div>
          <div className="col" style={{ gap: 12, marginTop: 6 }}>
            {[
              { n: 'Kit Reparo', cur: 34, meta: 40 },
              { n: 'Pneus', cur: 52, meta: 40 },
              { n: 'Peças Motor', cur: 22, meta: 25 },
            ].map((item) => (
              <div key={item.n} className="col" style={{ gap: 4 }}>
                <div className="row" style={{ justifyContent: 'space-between', fontSize: 14 }}>
                  <span>{item.n}</span>
                  <span className={`mono ${item.cur < item.meta ? 'red' : 'emerald'}`}>{item.cur}/{item.meta}</span>
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${(item.cur / 60) * 100}%`, background: item.cur < item.meta ? 'var(--red)' : 'var(--emerald)' }} />
                </div>
              </div>
            ))}
          </div>
          <div className="pill pill-cyan" style={{ fontSize: 13, marginTop: 'auto', alignSelf: 'flex-start' }}>
            🛒 Lista de compras automática
          </div>
        </Appear>

        {/* Card 3: Ranking de Guincho */}
        <Appear delay={0.6} y={30} className="panel col" style={{ padding: 28, gap: 18 }}>
          <span style={{ fontSize: 36 }}>🚛</span>
          <div className="col" style={{ gap: 4 }}>
            <b style={{ fontSize: 22 }}>Ranking Guincho</b>
            <span className="muted" style={{ fontSize: 14 }}>Desempenho da equipe</span>
          </div>
          <div className="col" style={{ gap: 10, marginTop: 6 }}>
            {[
              { pos: '1º', name: 'R. Santos', pts: 55 },
              { pos: '2º', name: 'L. Ferreira', pts: 44 },
              { pos: '3º', name: 'M. Douglas', pts: 41 },
            ].map((m) => (
              <div key={m.name} className="row" style={{ justifyContent: 'space-between', fontSize: 15, padding: '8px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <span className="row" style={{ gap: 8 }}>
                  <b className="gold">{m.pos}</b> {m.name}
                </span>
                <span className="mono cyan">{m.pts} pts</span>
              </div>
            ))}
          </div>
          <span className="muted" style={{ fontSize: 13, marginTop: 'auto' }}>Diferenciação Cidade vs Sandy Shores</span>
        </Appear>

        {/* Card 4: Faturas */}
        <Appear delay={0.75} y={30} className="panel col" style={{ padding: 28, gap: 18 }}>
          <span style={{ fontSize: 36 }}>🧾</span>
          <div className="col" style={{ gap: 4 }}>
            <b style={{ fontSize: 22 }}>Faturas & Ordens</b>
            <span className="muted" style={{ fontSize: 14 }}>Contabilidade da oficina</span>
          </div>
          <div className="col" style={{ gap: 10, marginTop: 6 }}>
            {[
              { serv: 'Guincho Fora', val: 'R$ 3.500' },
              { serv: 'Motor + Turbo', val: 'R$ 8.700' },
              { serv: 'Kit Reparo x2', val: 'R$ 3.000' },
            ].map((f) => (
              <div key={f.serv} className="row" style={{ justifyContent: 'space-between', fontSize: 14 }}>
                <span className="muted">{f.serv}</span>
                <span className="mono">{f.val}</span>
              </div>
            ))}
          </div>
          <div className="col" style={{ marginTop: 'auto', paddingTop: 10, borderTop: '1px solid var(--border)' }}>
            <span className="muted" style={{ fontSize: 13 }}>Faturamento Turno</span>
            <span className="mono emerald" style={{ fontSize: 26, fontWeight: 800 }}>R$ 15.200</span>
          </div>
        </Appear>
      </div>
    </div>
  );
}

/* ============================================================
 * 06 — Tempo Real & Discord Gateway
 * ============================================================ */
export function DiscordRealtimeScene() {
  const t = useElapsed();

  return (
    <div className="scene">
      <Header
        num="05"
        kicker="Sincronização 24/7"
        title={<>Tempo Real via <span style={{ color: '#818cf8' }}>Discord Gateway</span></>}
        lead="Push contínuo por WebSocket. Zero sobrecarga de requisições, latência de milissegundos."
      />

      <div className="row" style={{ gap: 48, marginTop: 44, alignItems: 'stretch' }}>
        {/* Comparativo */}
        <div className="col" style={{ width: 620, gap: 20 }}>
          <Appear delay={0.3} className="panel col" style={{ padding: 28, gap: 12, borderColor: 'rgba(248, 113, 113, 0.25)' }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <b style={{ fontSize: 20 }}>HTTP Polling Tradicional</b>
              <span className="mono red">1000–3000 ms</span>
            </div>
            <span className="muted" style={{ fontSize: 15 }}>
              Requisições repetitivas de segundo em segundo gerando risco de bloqueio <b>HTTP 429</b>.
            </span>
          </Appear>

          <Appear delay={0.5} className="panel col" style={{ padding: 28, gap: 14, borderColor: 'rgba(52, 211, 153, 0.4)' }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <b style={{ fontSize: 20 }}>WebSocket Gateway (Push)</b>
              <span className="mono emerald">10–30 ms</span>
            </div>
            <span className="muted" style={{ fontSize: 15 }}>
              Túnel TCP persistente oficial. O Discord entrega os eventos imediatamente.
            </span>
            <div className="row" style={{ gap: 10, marginTop: 4 }}>
              <span className="pill pill-emerald" style={{ fontSize: 13 }}>0 Rate Limit</span>
              <span className="pill" style={{ fontSize: 13 }}>40 bytes / 41s</span>
            </div>
          </Appear>
        </div>

        {/* Feed de Eventos */}
        <div className="col" style={{ flex: 1, gap: 16 }}>
          <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--subtle)' }}>FEED DE INGESTÃO CONTÍNUA</span>

          {[
            { ch: '#ponto', msg: '🟢 Ponto aberto — R. Santos (Turno Vespertino)', delay: 1.0 },
            { ch: '#baú', msg: '📦 Retirada: 5x Kit de Reparo por M. Douglas', delay: 1.8 },
            { ch: '#faturas', msg: '🧾 Fatura #1284 concluída · R$ 3.500', delay: 2.6 },
          ].map((item) =>
            t > item.delay ? (
              <motion.div
                key={item.ch}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="panel row"
                style={{ padding: '20px 24px', gap: 16, background: 'rgba(15, 23, 42, 0.6)' }}
              >
                <span className="pill" style={{ background: 'rgba(88, 101, 242, 0.15)', color: '#818cf8', borderColor: 'rgba(88, 101, 242, 0.3)', fontSize: 14 }}>
                  {item.ch}
                </span>
                <span style={{ fontSize: 17, flex: 1 }}>{item.msg}</span>
                <span className="mono emerald" style={{ fontSize: 14 }}>→ SQLite</span>
              </motion.div>
            ) : null,
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 * 07 — Engenharia & Confiabilidade
 * ============================================================ */
export function ResilienceScene() {
  const t = useElapsed();

  return (
    <div className="scene">
      <Header
        num="06"
        kicker="Infraestrutura"
        title={<>Engenharia de <span className="grad-cyan">Alta Performance</span></>}
        lead="Backend ultra-leve e banco de dados preparado para alta concorrência."
      />

      <div className="row" style={{ gap: 44, marginTop: 44, alignItems: 'stretch' }}>
        {/* SQLite WAL */}
        <Appear delay={0.3} className="panel col" style={{ flex: 1, padding: 36, gap: 20 }}>
          <span style={{ fontSize: 40 }}>🗄️</span>
          <div className="col" style={{ gap: 4 }}>
            <b style={{ fontSize: 26 }}>SQLite em Modo WAL</b>
            <span className="muted" style={{ fontSize: 16 }}>Write-Ahead Logging ativado</span>
          </div>

          <div style={{ background: 'rgba(3, 7, 18, 0.7)', borderRadius: 10, padding: 18, border: '1px solid var(--border)' }} className="mono cyan">
            PRAGMA journal_mode = WAL;<br />
            PRAGMA synchronous  = NORMAL;
          </div>

          <div className="col" style={{ gap: 12, marginTop: 8 }}>
            {[
              'Leituras e escritas concorrentes sem travamento',
              'Redução de operações de disco (fsync)',
              'Zero erros de "database is locked"',
            ].map((txt) => (
              <div key={txt} className="row" style={{ gap: 10, fontSize: 16 }}>
                <span className="emerald">✓</span> {txt}
              </div>
            ))}
          </div>
        </Appear>

        {/* Auditoria de Código */}
        <Appear delay={0.5} className="panel col" style={{ flex: 1, padding: 36, gap: 20 }}>
          <span style={{ fontSize: 40 }}>🛡️</span>
          <div className="col" style={{ gap: 4 }}>
            <b style={{ fontSize: 26 }}>24 Falhas Corrigidas</b>
            <span className="muted" style={{ fontSize: 16 }}>Auditoria e resiliência de memória</span>
          </div>

          <div className="col" style={{ gap: 14 }}>
            {[
              { t: 'Web Audio Singleton', d: 'Eliminou vazamento do limite de 6 AudioContexts' },
              { t: 'Zero Race Condition no OCR', d: 'AbortController cancela requisições anteriores' },
              { t: 'Quota Segura de Armazenamento', d: 'Miniaturas de 160×160 ocupando menos de 3 KB' },
            ].map((f) => (
              <div key={f.t} className="col" style={{ gap: 2, padding: '12px 14px', borderRadius: 8, background: 'rgba(255, 255, 255, 0.03)' }}>
                <span style={{ fontSize: 16, fontWeight: 700 }}>{f.t}</span>
                <span className="muted" style={{ fontSize: 14 }}>{f.d}</span>
              </div>
            ))}
          </div>
        </Appear>
      </div>
    </div>
  );
}

/* ============================================================
 * 08 — Encerramento
 * ============================================================ */
export function OutroScene() {
  const t = useElapsed();

  return (
    <div className="center-col" style={{ height: '100%', gap: 60 }}>
      <div className="row" style={{ gap: 36 }}>
        {[
          { num: '1,2s', label: 'tempo por ficha', color: 'var(--emerald)' },
          { num: '100%', label: 'local via WebAssembly', color: 'var(--cyan)' },
          { num: 'R$ 0', label: 'custo de operação', color: 'var(--gold)' },
        ].map((s, k) => (
          <Appear key={s.label} delay={0.2 + k * 0.15} y={30} className="panel col" style={{ width: 340, padding: '38px 24px', alignItems: 'center', gap: 10 }}>
            <span className="mono" style={{ fontSize: 64, fontWeight: 800, color: s.color }}>{s.num}</span>
            <span className="muted" style={{ fontSize: 18 }}>{s.label}</span>
          </Appear>
        ))}
      </div>

      <motion.div
        className="row"
        style={{ gap: 32 }}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.8, duration: 0.8, ease }}
      >
        <motion.img
          src="/assets/logo.png"
          style={{ width: 120, height: 120, clipPath: 'circle(46%)', filter: 'drop-shadow(0 0 40px rgba(56, 189, 248, 0.5))' }}
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 32, repeat: Infinity, ease: 'linear' }}
          alt="Logo"
        />
        <div className="col" style={{ alignItems: 'flex-start' }}>
          <span className="grad-text" style={{ fontSize: 72, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1 }}>
            Mecânica BRP
          </span>
          <span style={{ fontSize: 24, color: 'var(--muted)', marginTop: 8 }}>
            OCR inteligente &amp; gestão integrada · <span className="mono cyan">mecanica.neco.lat</span>
          </span>
        </div>
      </motion.div>
    </div>
  );
}
