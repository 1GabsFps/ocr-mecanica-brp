import { motion } from 'framer-motion';
import { ReactNode, useEffect, useState } from 'react';

export const ease = [0.22, 1, 0.36, 1] as const;

/** Seconds elapsed since the component mounted (rAF-driven). */
export function useElapsed() {
  const [t, setT] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const loop = (now: number) => {
      setT((now - start) / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return t;
}

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const easeOut = (x: number) => 1 - Math.pow(1 - clamp(x), 3);

/** Progress 0..1 of a window [start, start+dur] at time t. */
export const prog = (t: number, start: number, dur: number) => easeOut((t - start) / dur);

export function typed(text: string, t: number, start: number, cps = 18) {
  const n = Math.floor(clamp((t - start) * cps, 0, text.length));
  return text.slice(0, n);
}

export function Typer({ text, t, start, cps = 18, caret = true }: { text: string; t: number; start: number; cps?: number; caret?: boolean }) {
  const s = typed(text, t, start, cps);
  const typing = t >= start && s.length < text.length;
  return (
    <>
      {s}
      {caret && typing && <span className="caret" />}
    </>
  );
}

export function Count({ t, start, dur, to, from = 0, decimals = 0, suffix = '', prefix = '' }: { t: number; start: number; dur: number; to: number; from?: number; decimals?: number; suffix?: string; prefix?: string }) {
  const v = from + (to - from) * prog(t, start, dur);
  return (
    <>
      {prefix}
      {v.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </>
  );
}

export function Header({ num, kicker, title, lead }: { num: string; kicker: string; title: ReactNode; lead?: ReactNode }) {
  return (
    <div>
      <motion.div className="kicker" initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, ease }}>
        <span className="num">{num}</span>
        {kicker}
      </motion.div>
      <motion.h1 className="h1" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1, ease }}>
        {title}
      </motion.h1>
      {lead && (
        <motion.p className="lead" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.25, ease }}>
          {lead}
        </motion.p>
      )}
    </div>
  );
}

/** Fade/slide-up appearance helper. */
export function Appear({ delay = 0, y = 30, x = 0, scale = 1, children, className, style }: { delay?: number; y?: number; x?: number; scale?: number; children?: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, y, x, scale }}
      animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
      transition={{ duration: 0.7, delay, ease }}
    >
      {children}
    </motion.div>
  );
}
