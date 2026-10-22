import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useState } from 'react';
import {
  DiscordRealtimeScene,
  InterfaceScene,
  IntroScene,
  LocalOcrScene,
  OperationsScene,
  OutroScene,
  ProblemSolutionScene,
  ResilienceScene,
} from './scenes/cleanScenes';

/** Ordem e duração (s) de cada cena do vídeo redesenhado (sem poluição, modelo local). */
const SCENES = [
  { label: 'Abertura', C: IntroScene, d: 7.5 },
  { label: 'Produtividade', C: ProblemSolutionScene, d: 8.0 },
  { label: 'OCR Local WebAssembly', C: LocalOcrScene, d: 9.0 },
  { label: 'Interface & Ergonomia', C: InterfaceScene, d: 8.5 },
  { label: 'Gestão Operacional', C: OperationsScene, d: 9.5 },
  { label: 'Discord Tempo Real', C: DiscordRealtimeScene, d: 8.5 },
  { label: 'Engenharia & Resiliência', C: ResilienceScene, d: 8.0 },
  { label: 'Encerramento', C: OutroScene, d: 7.5 },
];

const TOTAL = SCENES.reduce((s, x) => s + x.d, 0);
(window as any).__videoDuration = TOTAL;

function Background() {
  return (
    <>
      <div className="grid-bg" />
      <motion.div
        className="orb"
        style={{ width: 800, height: 800, background: '#0284c7', left: -250, top: -250 }}
        animate={{ x: [0, 240, 0], y: [0, 160, 0] }}
        transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="orb"
        style={{ width: 700, height: 700, background: '#059669', right: -250, bottom: -250 }}
        animate={{ x: [0, -220, 0], y: [0, -150, 0] }}
        transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut' }}
      />
    </>
  );
}

export default function App() {
  const params = new URLSearchParams(location.search);
  const record = params.has('record');
  const [i, setI] = useState(() => Math.min(SCENES.length - 1, Math.max(0, Number(params.get('scene') ?? 1) - 1)));
  const [started, setStarted] = useState(record);
  const [run, setRun] = useState(0); // força remontagem ao reiniciar
  const [scale, setScale] = useState(1);
  const [sceneStart, setSceneStart] = useState(performance.now());
  const [now, setNow] = useState(performance.now());

  useEffect(() => {
    const fit = () => setScale(Math.min(innerWidth / 1920, innerHeight / 1080));
    fit();
    addEventListener('resize', fit);
    return () => removeEventListener('resize', fit);
  }, []);

  // Avanço automático das cenas
  useEffect(() => {
    if (!started) return;
    setSceneStart(performance.now());
    const id = setTimeout(() => {
      if (i < SCENES.length - 1) setI(i + 1);
      else (window as any).__videoDone = true;
    }, SCENES[i].d * 1000);
    return () => clearTimeout(id);
  }, [i, started, run]);

  // Relógio da barra de progresso
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      setNow(performance.now());
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const go = useCallback((n: number) => {
    setI(Math.min(SCENES.length - 1, Math.max(0, n)));
    setRun((r) => r + 1);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(i + 1);
      else if (e.key === 'ArrowLeft') go(i - 1);
      else if (e.key.toLowerCase() === 'r') { setStarted(true); go(0); }
      else if (e.key === ' ' || e.key === 'Enter') setStarted(true);
      else if (e.key.toLowerCase() === 'f') document.documentElement.requestFullscreen?.();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [i, go]);

  const { C } = SCENES[i];
  const sceneP = started ? Math.min(1, (now - sceneStart) / (SCENES[i].d * 1000)) : 0;

  return (
    <div className="viewport">
      <div className="stage" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
        <Background />

        <AnimatePresence mode="wait">
          {started && (
            <motion.div
              key={`${i}-${run}`}
              style={{ position: 'absolute', inset: 0 }}
              initial={{ opacity: 0, scale: 1.02, filter: 'blur(10px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.98, filter: 'blur(8px)' }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              <C />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="vignette" />

        {started && i > 0 && i < SCENES.length - 1 && (
          <>
            <div className="hud-brand">
              <img src="/assets/logo.png" alt="" /> Mecânica BRP
            </div>
            <div className="hud-label">{SCENES[i].label}</div>
          </>
        )}

        <div className="progress-track">
          {SCENES.map((_, k) => (
            <div key={k} className="progress-seg">
              <div
                className="progress-fill"
                style={{ width: `${k < i ? 100 : k === i ? sceneP * 100 : 0}%` }}
              />
            </div>
          ))}
        </div>

        {!started && (
          <div className="start-overlay" onClick={() => setStarted(true)}>
            <motion.div
              className="start-btn"
              whileHover={{ scale: 1.04 }}
              animate={{ scale: [1, 1.03, 1] }}
              transition={{ repeat: Infinity, duration: 2.2 }}
            >
              ▶ Iniciar apresentação
            </motion.div>
            <div className="help">
              Espaço / Enter: iniciar · ← → navegar · R: reiniciar · F: tela cheia · duração ≈ {Math.round(TOTAL)}s
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
