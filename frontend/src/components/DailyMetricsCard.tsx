import React, { useEffect, useRef, useState } from 'react';
import {
  Image as ImageIcon,
  Target,
  Zap,
  Activity,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { DailyMetricsSummary } from '../utils/dailyStatsStorage';

interface DailyMetricsCardProps {
  metrics: DailyMetricsSummary;
}

/**
 * Hook de animação count-up: anima um número de 0 até o valor final com easing suave.
 */
function useCountUp(target: number, duration: number = 1200, decimals: number = 0): string {
  const [value, setValue] = useState(0);
  const prevTarget = useRef(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const start = prevTarget.current;
    const end = target;
    prevTarget.current = target;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Easing: easeOutExpo (desacelera suavemente)
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = start + (end - start) * eased;
      setValue(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return decimals > 0 ? value.toFixed(decimals) : Math.round(value).toString();
}

export const DailyMetricsCard: React.FC<DailyMetricsCardProps> = ({ metrics }) => {
  const animatedTotal = useCountUp(metrics.totalToday, 1000);
  const animatedSuccess = useCountUp(metrics.successCount, 1000);
  const animatedRate = useCountUp(
    metrics.totalToday > 0 ? metrics.successRate : 100,
    1200
  );
  const animatedAvg = useCountUp(
    parseFloat(metrics.avgDurationSec) || 0,
    1400,
    2
  );
  const animatedFastest = useCountUp(
    parseFloat(metrics.fastestDurationSec) || 0,
    1400,
    2
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-[#0c1220]/90 border border-[#1e293b] rounded-2xl p-4 sm:p-5 shadow-xl backdrop-blur-md relative overflow-hidden"
    >
      {/* Glow de Fundo Sutil */}
      <div className="absolute top-0 right-0 w-64 h-32 bg-blue-600/10 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Cabeçalho da Telemetria */}
      <div className="flex items-center justify-between pb-3.5 border-b border-[#1e293b]/80 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-950/80 border border-blue-800/60 flex items-center justify-center">
            <Activity className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <span>Desempenho do Sistema</span>
              <span className="text-[10px] text-slate-400 font-normal font-mono lowercase">(últimas 24h)</span>
            </h3>
          </div>
        </div>
      </div>

      {/* Grid com os 3 Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-3.5">
        {/* 1. Imagens Enviadas Hoje */}
        <div className="bg-[#080d1a] border border-[#1e293b] rounded-xl p-3.5 flex items-center justify-between gap-3 hover:border-blue-800/60 transition-colors">
          <div className="space-y-0.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Envios Hoje
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-black text-white font-mono tracking-tight tabular-nums">
                {animatedTotal}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {metrics.totalToday === 1 ? 'imagem' : 'imagens'}
              </span>
            </div>
            <p className="text-[10px] text-slate-400">
              {metrics.totalToday > 0 ? `${animatedSuccess} fichas completas` : 'Pronto para receber prints'}
            </p>
          </div>

          <div className="w-10 h-10 rounded-xl bg-blue-950/80 border border-blue-800/50 flex items-center justify-center shrink-0">
            <ImageIcon className="w-5 h-5 text-blue-400" />
          </div>
        </div>

        {/* 2. Taxa de Acerto (Precisão) */}
        <div className="bg-[#080d1a] border border-[#1e293b] rounded-xl p-3.5 flex items-center justify-between gap-3 hover:border-emerald-800/60 transition-colors">
          <div className="space-y-0.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Taxa de Acerto
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-black text-emerald-400 font-mono tracking-tight tabular-nums">
                {animatedRate}%
              </span>
              <span className="text-[10px] text-emerald-500 font-mono font-bold">
                {metrics.totalToday > 0 && metrics.successRate >= 95 ? '⚡ Alta Precisão' : 'Calibrado'}
              </span>
            </div>
            <p className="text-[10px] text-slate-400">
              Campos essenciais identificados
            </p>
          </div>

          <div className="w-10 h-10 rounded-xl bg-emerald-950/80 border border-emerald-800/50 flex items-center justify-center shrink-0">
            <Target className="w-5 h-5 text-emerald-400" />
          </div>
        </div>

        {/* 3. Tempo Médio de Resposta */}
        <div className="bg-[#080d1a] border border-[#1e293b] rounded-xl p-3.5 flex items-center justify-between gap-3 hover:border-amber-800/60 transition-colors">
          <div className="space-y-0.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Tempo Médio
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-black text-amber-400 font-mono tracking-tight tabular-nums">
                {animatedAvg}s
              </span>
              <span className="text-[10px] text-amber-400 font-mono">
                / requisição
              </span>
            </div>
            <p className="text-[10px] text-slate-400">
              Melhor tempo: <strong className="text-slate-300 font-mono">{animatedFastest}s</strong>
            </p>
          </div>

          <div className="w-10 h-10 rounded-xl bg-amber-950/80 border border-amber-800/50 flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5 text-amber-400 fill-amber-400/20" />
          </div>
        </div>
      </div>
    </motion.div>
  );
};
