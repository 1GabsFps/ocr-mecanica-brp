import React, { useState, useEffect, memo } from 'react';
import {
  Disc,
  CircleDot,
  GitCommit,
  Gauge,
  Droplets,
  X,
  Zap,
  Flame,
  Compass,
  RotateCcw,
  Check,
  Wrench,
  Cog,
  Store,
  UserCheck,
  Plus,
  Minus,
  PackageMinus,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { playChipSelectSound, playTrashSound } from '../utils/soundEffects';

type ServiceMode = 'oleo' | 'tuning' | 'retifica' | 'extra';

export interface SelectedTuningParts {
  freio: string | null;
  pneu: string | null;
  suspensao: string | null;
  direcao: string | null;
}

export type PartOrigin = 'mec' | 'cliente';

export const VALID_CYLINDERS = [3, 4, 5, 6, 8, 10, 12, 16] as const;
export type ValidCylinderCount = typeof VALID_CYLINDERS[number];

export interface SelectedRetificaParts {
  bloco: boolean;
  blocoCilindros: ValidCylinderCount;
  pistoes: boolean;
  pistoesOrigem: PartOrigin;
  bielas: boolean;
  bielasOrigem: PartOrigin;
  cabecote: boolean;
  cabecoteOrigem: PartOrigin;
  virabrequim: boolean;
  cilindros: boolean;
  turbina: boolean;
}

interface PartsSelectorProps {
  currentServico: string;
  onServicoChange: (newServico: string) => void;
}

interface PartItem {
  id: string;
  name: string;
  badge: string;
  badgeColor: string;
  desc: string;
}

interface TuningCategory {
  id: 'freio' | 'pneu' | 'suspensao' | 'direcao';
  name: string;
  icon: React.ElementType;
  items: PartItem[];
}

const TUNING_CATEGORIES: TuningCategory[] = [
  {
    id: 'freio',
    name: 'Freios',
    icon: Disc,
    items: [
      {
        id: 'freio_rua',
        name: 'Freio Rua Super',
        badge: 'Rua',
        badgeColor: 'bg-sky-950/80 text-sky-300 border-sky-800/60',
        desc: 'Balanceado para rua e temperatura constante',
      },
      {
        id: 'freio_carbon',
        name: 'Freio Ceramic Carbon',
        badge: 'Corrida',
        badgeColor: 'bg-rose-950/80 text-rose-300 border-rose-800/60',
        desc: 'Performance extrema em alta temperatura',
      },
    ],
  },
  {
    id: 'pneu',
    name: 'Pneus',
    icon: CircleDot,
    items: [
      {
        id: 'pneu_rua',
        name: 'Pneus Rua Super',
        badge: 'Rua',
        badgeColor: 'bg-sky-950/80 text-sky-300 border-sky-800/60',
        desc: 'Mais aderência e uso em qualquer condição',
      },
      {
        id: 'pneu_slick',
        name: 'Pneus Semi Slick',
        badge: 'Corrida',
        badgeColor: 'bg-rose-950/80 text-rose-300 border-rose-800/60',
        desc: 'Aderência máxima no asfalto seco',
      },
      {
        id: 'pneu_drift',
        name: 'Pneus Drift',
        badge: 'Drift',
        badgeColor: 'bg-amber-950/80 text-amber-300 border-amber-800/60',
        desc: 'Baixo atrito para facilitar derrapagens controladas',
      },
      {
        id: 'pneu_offroad',
        name: 'Pneus Offroad',
        badge: 'Offroad',
        badgeColor: 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60',
        desc: 'Tração superior em terra, cascalho e lama',
      },
    ],
  },
  {
    id: 'suspensao',
    name: 'Suspensão',
    icon: GitCommit,
    items: [
      {
        id: 'susp_sport',
        name: 'Suspensão Esportiva',
        badge: 'Rua',
        badgeColor: 'bg-sky-950/80 text-sky-300 border-sky-800/60',
        desc: 'Estabilidade com conforto para o dia a dia',
      },
      {
        id: 'susp_track',
        name: 'Suspensão Track',
        badge: 'Corrida',
        badgeColor: 'bg-rose-950/80 text-rose-300 border-rose-800/60',
        desc: 'Firmeza máxima para extrair curvas em alta',
      },
      {
        id: 'susp_offroad',
        name: 'Suspensão Offroad',
        badge: 'Offroad',
        badgeColor: 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60',
        desc: 'Absorve irregularidades e saltos no terreno',
      },
    ],
  },
  {
    id: 'direcao',
    name: 'Direção',
    icon: Gauge,
    items: [
      {
        id: 'dir_racing',
        name: 'Direção Racing',
        badge: 'Corrida',
        badgeColor: 'bg-rose-950/80 text-rose-300 border-rose-800/60',
        desc: 'Agilidade rápida para antecipar curvas',
      },
      {
        id: 'dir_drift',
        name: 'Kit Ângulo de Drift',
        badge: 'Drift',
        badgeColor: 'bg-amber-950/80 text-amber-300 border-amber-800/60',
        desc: 'Maior esterçamento de roda para ângulo de drift',
      },
    ],
  },
];

const TUNING_PRESETS = [
  {
    name: 'Full Street',
    icon: Zap,
    color: 'hover:text-sky-300 hover:border-sky-700/60',
    setup: {
      freio: 'Freio Rua Super',
      pneu: 'Pneus Rua Super',
      suspensao: 'Suspensão Esportiva',
      direcao: 'Direção Racing',
    },
  },
  {
    name: 'Full Track',
    icon: Flame,
    color: 'hover:text-rose-300 hover:border-rose-700/60',
    setup: {
      freio: 'Freio Ceramic Carbon',
      pneu: 'Pneus Semi Slick',
      suspensao: 'Suspensão Track',
      direcao: 'Direção Racing',
    },
  },
  {
    name: 'Full Drift',
    icon: Flame,
    color: 'hover:text-amber-300 hover:border-amber-700/60',
    setup: {
      freio: 'Freio Ceramic Carbon',
      pneu: 'Pneus Drift',
      suspensao: 'Suspensão Track',
      direcao: 'Kit Ângulo de Drift',
    },
  },
  {
    name: 'Full Offroad',
    icon: Compass,
    color: 'hover:text-emerald-300 hover:border-emerald-700/60',
    setup: {
      freio: 'Freio Rua Super',
      pneu: 'Pneus Offroad',
      suspensao: 'Suspensão Offroad',
      direcao: null,
    },
  },
];

interface RetificaPreset {
  id: string;
  name: string;
  symptom: string;
  rule: string;
  setup: SelectedRetificaParts;
}

const RETIFICA_PRESETS: RetificaPreset[] = [
  {
    id: 'quebra_pistao',
    name: 'Quebra de Pistão (+ Bloco)',
    symptom: 'Quebra de pistão com dano no motor',
    rule: 'Pistão quebrado exige troca de pistões e bloco',
    setup: {
      pistoes: true,
      pistoesOrigem: 'mec',
      bloco: true,
      blocoCilindros: 4,
      bielas: false,
      bielasOrigem: 'mec',
      cabecote: false,
      cabecoteOrigem: 'mec',
      virabrequim: false,
      cilindros: false,
      turbina: false,
    },
  },
  {
    id: 'quebra_biela',
    name: 'Quebra de Biela (+ Bloco)',
    symptom: 'Quebra de biela com dano no motor',
    rule: 'Biela quebrada exige troca de bielas e bloco',
    setup: {
      pistoes: false,
      pistoesOrigem: 'mec',
      bloco: true,
      blocoCilindros: 4,
      bielas: true,
      bielasOrigem: 'mec',
      cabecote: false,
      cabecoteOrigem: 'mec',
      virabrequim: false,
      cilindros: false,
      turbina: false,
    },
  },
  {
    id: 'quebra_pistao_biela',
    name: 'Pistão + Biela Quebrados (+ Bloco)',
    symptom: 'Quebra interna grave de pistão e biela',
    rule: 'Substituição completa do conjunto e bloco',
    setup: {
      pistoes: true,
      pistoesOrigem: 'mec',
      bloco: true,
      blocoCilindros: 4,
      bielas: true,
      bielasOrigem: 'mec',
      cabecote: false,
      cabecoteOrigem: 'mec',
      virabrequim: false,
      cilindros: false,
      turbina: false,
    },
  },
  {
    id: 'virabrequim',
    name: 'Motor Travado / Virabrequim',
    symptom: 'Motor travado ou folga no virabrequim (sem quebra)',
    rule: 'Retífica / Troca do virabrequim',
    setup: {
      pistoes: false,
      pistoesOrigem: 'mec',
      bloco: false,
      blocoCilindros: 4,
      bielas: false,
      bielasOrigem: 'mec',
      cabecote: false,
      cabecoteOrigem: 'mec',
      virabrequim: true,
      cilindros: false,
      turbina: false,
    },
  },
  {
    id: 'cilindros_fumando',
    name: 'Motor Fumando (Cilindros)',
    symptom: 'Fumaça no escape por desgaste de cilindro/camisa',
    rule: 'Brunimento e retífica de cilindros',
    setup: {
      pistoes: false,
      pistoesOrigem: 'mec',
      bloco: false,
      blocoCilindros: 4,
      bielas: false,
      bielasOrigem: 'mec',
      cabecote: false,
      cabecoteOrigem: 'mec',
      virabrequim: false,
      cilindros: true,
      turbina: false,
    },
  },
  {
    id: 'turbina_fumando',
    name: 'Motor Fumando (Turbina)',
    symptom: 'Fumaça branca/azulada por passagem de óleo na turbina',
    rule: 'Substituição / Reparo de Turbina',
    setup: {
      pistoes: false,
      pistoesOrigem: 'mec',
      bloco: false,
      blocoCilindros: 4,
      bielas: false,
      bielasOrigem: 'mec',
      cabecote: false,
      cabecoteOrigem: 'mec',
      virabrequim: false,
      cilindros: false,
      turbina: true,
    },
  },
  {
    id: 'retifica_completa',
    name: 'Retífica Completa do Motor',
    symptom: 'Revisão total e reconstrução do conjunto motriz',
    rule: 'Bloco, Pistões, Bielas, Cabeçote, Virabrequim e Cilindros',
    setup: {
      pistoes: true,
      pistoesOrigem: 'mec',
      bloco: true,
      blocoCilindros: 4,
      bielas: true,
      bielasOrigem: 'mec',
      cabecote: true,
      cabecoteOrigem: 'mec',
      virabrequim: true,
      cilindros: true,
      turbina: false,
    },
  },
];

function parseServiceMode(currentServico: string): ServiceMode {
  const s = currentServico.toLowerCase();
  if (
    s.includes('retífica') ||
    s.includes('retifica') ||
    s.includes('bloco') ||
    s.includes('pistão') ||
    s.includes('pistao') ||
    s.includes('biela') ||
    s.includes('cabeçote') ||
    s.includes('cabecote') ||
    s.includes('virabrequim') ||
    s.includes('turbina')
  ) {
    return 'retifica';
  }
  if (
    s.includes('performance') ||
    s.includes('tuning') ||
    s.includes('freio') ||
    s.includes('pneu') ||
    s.includes('suspens') ||
    s.includes('dire') ||
    s.includes('slick') ||
    s.includes('drift') ||
    s.includes('ceramic')
  ) {
    return 'tuning';
  }
  if (s.includes('remoção') || s.includes('remocao')) {
    return 'extra';
  }
  return 'oleo';
}

function parseRemocaoPeca(currentServico: string): boolean {
  const s = currentServico.toLowerCase();
  return s.includes('remoção de peça') || s.includes('remocao de peca') || s.includes('remoção') || s.includes('remocao');
}

function parseTuningParts(currentServico: string): SelectedTuningParts {
  return {
    freio: TUNING_CATEGORIES[0].items.find((i) => currentServico.includes(i.name))?.name || null,
    pneu: TUNING_CATEGORIES[1].items.find((i) => currentServico.includes(i.name))?.name || null,
    suspensao: TUNING_CATEGORIES[2].items.find((i) => currentServico.includes(i.name))?.name || null,
    direcao: TUNING_CATEGORIES[3].items.find((i) => currentServico.includes(i.name))?.name || null,
  };
}

function parseRetificaParts(currentServico: string): SelectedRetificaParts {
  const s = currentServico.toLowerCase();
  let numCilindros: ValidCylinderCount = 4;
  const match = s.match(/bloco\s+(\d+)\s+cilindros/);
  if (match && match[1]) {
    const parsed = parseInt(match[1], 10) as ValidCylinderCount;
    if (VALID_CYLINDERS.includes(parsed)) {
      numCilindros = parsed;
    }
  }

  // Remove menções de "bloco X cilindros" ou "bloco do motor" para não confundir com o chip avulso "Cilindros"
  const sWithoutBloco = s
    .replace(/bloco\s+\d+\s+cilindros/g, '')
    .replace(/bloco\s+do\s+motor/g, '');
  const hasCilindrosAvulso = /\bcilindros?\b/i.test(sWithoutBloco);

  return {
    bloco: s.includes('bloco'),
    blocoCilindros: numCilindros,
    pistoes: s.includes('pistão') || s.includes('pistao') || s.includes('pistões') || s.includes('pistoes'),
    pistoesOrigem:
      s.includes('pistão do cliente') ||
      s.includes('pistao do cliente') ||
      s.includes('(pistão do cliente)') ||
      s.includes('(pistao do cliente)')
        ? 'cliente'
        : 'mec',
    bielas: s.includes('biela') || s.includes('bielas'),
    bielasOrigem:
      s.includes('biela do cliente') ||
      s.includes('bielas do cliente') ||
      s.includes('(biela do cliente)') ||
      s.includes('(bielas do cliente)')
        ? 'cliente'
        : 'mec',
    cabecote: s.includes('cabeçote') || s.includes('cabecote'),
    cabecoteOrigem:
      s.includes('cabeçote do cliente') ||
      s.includes('cabecote do cliente') ||
      s.includes('(cabeçote do cliente)') ||
      s.includes('(cabecote do cliente)')
        ? 'cliente'
        : 'mec',
    virabrequim: s.includes('virabrequim'),
    cilindros: hasCilindrosAvulso,
    turbina: s.includes('turbina'),
  };
}

export const PartsSelector: React.FC<PartsSelectorProps> = memo(({
  currentServico,
  onServicoChange,
}) => {
  // Determina o modo inicial baseado no texto atual do serviço
  const [serviceMode, setServiceMode] = useState<ServiceMode>(() => parseServiceMode(currentServico));
  const [remocaoPeca, setRemocaoPeca] = useState<boolean>(() => parseRemocaoPeca(currentServico));
  const [activeTuningTab, setActiveTuningTab] = useState<'freio' | 'pneu' | 'suspensao' | 'direcao'>('freio');
  const [tuningParts, setTuningParts] = useState<SelectedTuningParts>(() => parseTuningParts(currentServico));
  const [retificaParts, setRetificaParts] = useState<SelectedRetificaParts>(() => parseRetificaParts(currentServico));

  // SINCRONIZAÇÃO EM TEMPO REAL: Ao alterar a prop currentServico (histórico / reset / OCR)
  useEffect(() => {
    setServiceMode(parseServiceMode(currentServico));
    setRemocaoPeca(parseRemocaoPeca(currentServico));
    setTuningParts(parseTuningParts(currentServico));
    setRetificaParts(parseRetificaParts(currentServico));
  }, [currentServico]);

  // Sincroniza o texto do serviço com o modo, as peças ativas e a Remoção de Peça
  const syncServiceText = (
    mode: ServiceMode,
    tParts: SelectedTuningParts,
    rParts: SelectedRetificaParts,
    isRemocao: boolean
  ) => {
    let baseItems: string[] = [];

    if (mode === 'oleo') {
      baseItems = ['Troca de óleo e filtro'];
    } else if (mode === 'tuning') {
      if (tParts.freio) baseItems.push(tParts.freio);
      if (tParts.pneu) baseItems.push(tParts.pneu);
      if (tParts.suspensao) baseItems.push(tParts.suspensao);
      if (tParts.direcao) baseItems.push(tParts.direcao);

      if (baseItems.length === 0 && !isRemocao) {
        baseItems = ['Troca de peças de performance'];
      }
    } else if (mode === 'retifica') {
      if (rParts.bloco) {
        if (rParts.blocoCilindros === 4) {
          baseItems.push('Bloco do Motor');
        } else {
          baseItems.push(`Bloco ${rParts.blocoCilindros} cilindros`);
        }
      }
      if (rParts.pistoes) {
        baseItems.push(rParts.pistoesOrigem === 'cliente' ? '(Pistão do cliente)' : 'Pistão original');
      }
      if (rParts.bielas) {
        baseItems.push(rParts.bielasOrigem === 'cliente' ? '(Biela do cliente)' : 'Biela original');
      }
      if (rParts.cabecote) {
        baseItems.push(rParts.cabecoteOrigem === 'cliente' ? '(Cabeçote do cliente)' : 'Cabeçote original');
      }
      if (rParts.virabrequim) baseItems.push('Virabrequim');
      if (rParts.cilindros) baseItems.push('Cilindros');
      if (rParts.turbina) baseItems.push('Turbina');

      if (baseItems.length === 0 && !isRemocao) {
        baseItems = ['Retífica de motor'];
      }
    }

    // Se a opção Extra de Remoção de Peça estiver ativa, concatena junto
    const finalItems = [...baseItems];
    if (isRemocao && !finalItems.includes('Remoção de peça')) {
      finalItems.push('Remoção de peça');
    }

    if (finalItems.length === 0) {
      onServicoChange(isRemocao ? 'Remoção de peça' : 'Troca de óleo e filtro');
      return;
    }

    onServicoChange(finalItems.join(', '));
  };

  // Alterna o Modo Principal de Serviço
  const handleSwitchMode = (mode: ServiceMode) => {
    playChipSelectSound();
    setServiceMode(mode);
    syncServiceText(mode, tuningParts, retificaParts, remocaoPeca);

    if (mode === 'oleo') {
      toast.info('Modo Troca de Óleo ativado');
    } else if (mode === 'tuning') {
      toast.info('Modo Performance & Peças ativado');
    } else if (mode === 'retifica') {
      toast.info('Modo Retífica de Motor ativado');
    } else if (mode === 'extra') {
      toast.info('Aba Extra aberta', { description: 'Remoção de peça pode ser combinada com qualquer aba.' });
    }
  };

  // Alternar Remoção de Peça (Opção Extra combinável)
  const handleToggleRemocaoPeca = () => {
    playChipSelectSound();
    setRemocaoPeca((prev) => {
      const next = !prev;
      syncServiceText(serviceMode, tuningParts, retificaParts, next);
      if (next) {
        toast.success('Remoção de peça adicionada!', {
          description: 'Esta opção pode ser usada individualmente ou junto com qualquer outra aba.',
          duration: 2500,
        });
      } else {
        toast('Remoção de peça desativada', { duration: 1500 });
      }
      return next;
    });
  };

  // Funções de Tuning
  const handleSelectTuningPart = (categoryId: 'freio' | 'pneu' | 'suspensao' | 'direcao', partName: string) => {
    playChipSelectSound();
    setTuningParts((prev) => {
      const isDeselecting = prev[categoryId] === partName;
      const nextVal = isDeselecting ? null : partName;
      const next = { ...prev, [categoryId]: nextVal };
      syncServiceText('tuning', next, retificaParts, remocaoPeca);
      if (!isDeselecting) {
        toast.success(`${partName} instalado!`, { duration: 1500 });
      } else {
        toast(`${partName} removido`, { duration: 1200 });
      }
      return next;
    });
  };

  const handleRemoveTuningPart = (categoryId: 'freio' | 'pneu' | 'suspensao' | 'direcao') => {
    playChipSelectSound();
    const removedName = tuningParts[categoryId];
    setTuningParts((prev) => {
      const next = { ...prev, [categoryId]: null };
      syncServiceText('tuning', next, retificaParts, remocaoPeca);
      return next;
    });
    if (removedName) {
      toast(`${removedName} removido`, { duration: 1200 });
    }
  };

  const handleApplyTuningPreset = (preset: typeof TUNING_PRESETS[0]) => {
    playChipSelectSound();
    setTuningParts(preset.setup);
    syncServiceText('tuning', preset.setup, retificaParts, remocaoPeca);
    toast.success(`Setup ${preset.name} aplicado com sucesso!`, {
      description: 'Peças de performance configuradas.',
      duration: 2000,
    });
  };

  const handleClearTuningParts = () => {
    playTrashSound();
    const cleanState = {
      freio: null,
      pneu: null,
      suspensao: null,
      direcao: null,
    };
    setTuningParts(cleanState);
    syncServiceText('tuning', cleanState, retificaParts, remocaoPeca);
    toast.info('Peças de performance limpas');
  };

  // Funções de Retífica
  const handleToggleRetificaPart = (partKey: 'bloco' | 'pistoes' | 'bielas' | 'cabecote' | 'virabrequim' | 'cilindros' | 'turbina') => {
    playChipSelectSound();
    setRetificaParts((prev) => {
      const nextVal = !prev[partKey];
      let next = { ...prev, [partKey]: nextVal };

      if ((partKey === 'pistoes' || partKey === 'bielas') && nextVal && !next.bloco) {
        next.bloco = true;
        toast.info('Bloco do Motor incluído automaticamente', {
          description: 'Regra: Quebra de pistão ou biela exige substituição do bloco.',
          duration: 3000,
        });
      }

      syncServiceText('retifica', tuningParts, next, remocaoPeca);
      return next;
    });
  };

  const handleChangeBlocoCilindros = (delta: 1 | -1, e: React.MouseEvent) => {
    e.stopPropagation();
    playChipSelectSound();
    setRetificaParts((prev) => {
      const currentIndex = VALID_CYLINDERS.indexOf(prev.blocoCilindros);
      let nextIndex = currentIndex + delta;

      if (nextIndex < 0) nextIndex = 0;
      if (nextIndex >= VALID_CYLINDERS.length) nextIndex = VALID_CYLINDERS.length - 1;

      const nextCilindros = VALID_CYLINDERS[nextIndex];
      const next = { ...prev, bloco: true, blocoCilindros: nextCilindros };
      syncServiceText('retifica', tuningParts, next, remocaoPeca);

      const msg = nextCilindros === 4 ? 'Bloco do Motor (4 cilindros)' : `Bloco ${nextCilindros} cilindros`;
      toast.success(msg, { duration: 1500 });
      return next;
    });
  };

  const handleChangePartOrigin = (
    partKey: 'pistoesOrigem' | 'bielasOrigem' | 'cabecoteOrigem',
    origin: PartOrigin,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    playChipSelectSound();
    setRetificaParts((prev) => {
      const next = { ...prev, [partKey]: origin };
      syncServiceText('retifica', tuningParts, next, remocaoPeca);
      const label = origin === 'cliente' ? '(Peça do cliente)' : 'Original';
      toast.success(`Origem alterada: ${label}`, { duration: 1500 });
      return next;
    });
  };

  const handleApplyRetificaPreset = (preset: RetificaPreset) => {
    playChipSelectSound();
    setRetificaParts(preset.setup);
    syncServiceText('retifica', tuningParts, preset.setup, remocaoPeca);
    toast.success(`Diagnóstico: ${preset.name}`, {
      description: preset.rule,
      duration: 2500,
    });
  };

  const handleClearRetificaParts = () => {
    playTrashSound();
    const cleanState: SelectedRetificaParts = {
      bloco: false,
      blocoCilindros: 4,
      pistoes: false,
      pistoesOrigem: 'mec',
      bielas: false,
      bielasOrigem: 'mec',
      cabecote: false,
      cabecoteOrigem: 'mec',
      virabrequim: false,
      cilindros: false,
      turbina: false,
    };
    setRetificaParts(cleanState);
    syncServiceText('retifica', tuningParts, cleanState, remocaoPeca);
    toast.info('Peças de retífica limpas');
  };

  const activeTuningCount = [
    tuningParts.freio,
    tuningParts.pneu,
    tuningParts.suspensao,
    tuningParts.direcao,
  ].filter(Boolean).length;

  const activeRetificaCount = [
    retificaParts.bloco,
    retificaParts.pistoes,
    retificaParts.bielas,
    retificaParts.cabecote,
    retificaParts.virabrequim,
    retificaParts.cilindros,
    retificaParts.turbina,
  ].filter(Boolean).length;

  const currentTuningCategory = TUNING_CATEGORIES.find((c) => c.id === activeTuningTab)!;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="bg-[#0b101d] border border-[#1e293b] rounded-xl p-4 space-y-4 shadow-lg"
    >
      {/* 1. SELETOR PRINCIPAL DE MODO DE SERVIÇO (4 ABAS COM INDICADOR DE MOLA) */}
      <div className="flex items-center gap-2 bg-[#070b14] p-1.5 rounded-xl border border-[#1e293b] relative flex-wrap sm:flex-nowrap">
        {/* Aba 1: Troca de Óleo */}
        <button
          type="button"
          onClick={() => handleSwitchMode('oleo')}
          className={`relative flex-1 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer z-10 ${
            serviceMode === 'oleo' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {serviceMode === 'oleo' && (
            <motion.div
              layoutId="mainServiceModeIndicator"
              className="absolute inset-0 bg-amber-600 rounded-lg shadow-md -z-10"
              transition={{ type: 'spring', stiffness: 450, damping: 32 }}
            />
          )}
          <Droplets className={`w-4 h-4 ${serviceMode === 'oleo' ? 'text-white fill-white' : 'text-amber-400'}`} />
          <span>Troca de Óleo</span>
        </button>

        {/* Aba 2: Performance & Peças */}
        <button
          type="button"
          onClick={() => handleSwitchMode('tuning')}
          className={`relative flex-1 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer z-10 ${
            serviceMode === 'tuning' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {serviceMode === 'tuning' && (
            <motion.div
              layoutId="mainServiceModeIndicator"
              className="absolute inset-0 bg-blue-600 rounded-lg shadow-md -z-10"
              transition={{ type: 'spring', stiffness: 450, damping: 32 }}
            />
          )}
          <Zap className={`w-4 h-4 ${serviceMode === 'tuning' ? 'text-white' : 'text-blue-400'}`} />
          <span>Performance & Peças</span>
          {activeTuningCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-white text-blue-900 font-mono">
              {activeTuningCount}
            </span>
          )}
        </button>

        {/* Aba 3: Retífica de Motor */}
        <button
          type="button"
          onClick={() => handleSwitchMode('retifica')}
          className={`relative flex-1 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer z-10 ${
            serviceMode === 'retifica' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {serviceMode === 'retifica' && (
            <motion.div
              layoutId="mainServiceModeIndicator"
              className="absolute inset-0 bg-rose-600 rounded-lg shadow-md -z-10"
              transition={{ type: 'spring', stiffness: 450, damping: 32 }}
            />
          )}
          <Wrench className={`w-4 h-4 ${serviceMode === 'retifica' ? 'text-white' : 'text-rose-400'}`} />
          <span>Retífica de Motor</span>
          {activeRetificaCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-white text-rose-900 font-mono">
              {activeRetificaCount}
            </span>
          )}
        </button>

        {/* Aba 4: Extra (Remoção de Peça) */}
        <button
          type="button"
          onClick={() => handleSwitchMode('extra')}
          className={`relative flex-1 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer z-10 ${
            serviceMode === 'extra' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {serviceMode === 'extra' && (
            <motion.div
              layoutId="mainServiceModeIndicator"
              className="absolute inset-0 bg-purple-600 rounded-lg shadow-md -z-10"
              transition={{ type: 'spring', stiffness: 450, damping: 32 }}
            />
          )}
          <PackageMinus className={`w-4 h-4 ${serviceMode === 'extra' ? 'text-white' : 'text-purple-400'}`} />
          <span>Extra</span>
          {remocaoPeca && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-emerald-500 text-white font-mono flex items-center gap-0.5">
              ✓ Ativo
            </span>
          )}
        </button>
      </div>

      {/* 2. CONTEÚDO DINÂMICO DE ACORDO COM A ABA ATIVA */}
      <AnimatePresence mode="wait">
        {/* ======================= MODO 1: TROCA DE ÓLEO ======================= */}
        {serviceMode === 'oleo' && (
          <motion.div
            key="mode-oleo"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-3"
          >
            <div className="bg-[#0f172a] border border-amber-900/40 rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-950/80 border border-amber-800/60 flex items-center justify-center shrink-0">
                  <Droplets className="w-5 h-5 text-amber-400 fill-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Troca de Óleo e Filtro de Motor
                  </h3>
                  <p className="text-xs text-slate-400">
                    Ficha configurada para substituição de lubrificante e elemento filtrante.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 font-mono">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  Ativo na Ficha
                </span>
              </div>
            </div>

            {/* Atalho de Remoção de Peça na aba de Óleo */}
            <div className="p-3 bg-[#070b14] border border-[#1e293b] rounded-xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <PackageMinus className="w-4 h-4 text-purple-400 shrink-0" />
                <div>
                  <span className="text-xs font-bold text-slate-200">Remoção de Peça (Opção Extra)</span>
                  <p className="text-[11px] text-slate-400">Pode ser combinada junto com a troca de óleo nesta mesma ficha.</p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleToggleRemocaoPeca}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all cursor-pointer font-mono ${
                  remocaoPeca
                    ? 'bg-purple-950/80 border-purple-500 text-purple-300 shadow-sm'
                    : 'bg-[#111827] border-[#1e293b] text-slate-400 hover:text-white'
                }`}
              >
                {remocaoPeca ? '✓ Incluído' : '+ Incluir Remoção'}
              </button>
            </div>
          </motion.div>
        )}

        {/* ======================= MODO 2: PERFORMANCE & PEÇAS ======================= */}
        {serviceMode === 'tuning' && (
          <motion.div
            key="mode-tuning"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-3.5"
          >
            {/* Barra de Setups Rápidos */}
            <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-[#1e293b]/70">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] uppercase font-bold text-slate-400 mr-1 tracking-wider">
                  Setups Rápidos:
                </span>
                {TUNING_PRESETS.map((preset) => {
                  const Icon = preset.icon;
                  return (
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      key={preset.name}
                      type="button"
                      onClick={() => handleApplyTuningPreset(preset)}
                      className={`text-[11px] px-2.5 py-1 rounded-lg bg-[#111827] hover:bg-[#1a2337] text-slate-300 border border-[#1f2937] flex items-center gap-1.5 transition-colors cursor-pointer ${preset.color}`}
                      title={`Aplicar setup ${preset.name}`}
                    >
                      <Icon className="w-3 h-3 text-blue-400" />
                      <span>{preset.name}</span>
                    </motion.button>
                  );
                })}
              </div>

              {activeTuningCount > 0 && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  type="button"
                  onClick={handleClearTuningParts}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-900/50 flex items-center gap-1 transition-colors cursor-pointer"
                  title="Limpar peças de performance"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Limpar Peças</span>
                </motion.button>
              )}
            </div>

            {/* Resumo Visual das Peças Instaladas (Blueprint Bar) */}
            <div className="flex items-center gap-1.5 flex-wrap min-h-[28px]">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mr-1">Peças Ativas:</span>
              <AnimatePresence mode="popLayout">
                {activeTuningCount === 0 && !remocaoPeca ? (
                  <motion.span
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-[11px] text-slate-400 italic"
                  >
                    Nenhuma peça de performance selecionada
                  </motion.span>
                ) : (
                  <>
                    {TUNING_CATEGORIES.map((cat) => {
                      const selectedName = tuningParts[cat.id];
                      if (!selectedName) return null;

                      return (
                        <motion.span
                          key={cat.id + '-' + selectedName}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{ duration: 0.15 }}
                          className="inline-flex items-center gap-1.5 text-[11px] bg-blue-950/90 text-blue-200 border border-blue-700/60 px-2.5 py-0.5 rounded-lg font-mono shadow-sm"
                        >
                          <span className="text-blue-400 font-bold">{cat.name}:</span>
                          <span className="text-white">{selectedName}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveTuningPart(cat.id)}
                            className="text-slate-400 hover:text-rose-300 ml-0.5 cursor-pointer"
                            title={`Remover ${selectedName}`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </motion.span>
                      );
                    })}

                    {remocaoPeca && (
                      <motion.span
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="inline-flex items-center gap-1.5 text-[11px] bg-purple-950/90 text-purple-200 border border-purple-700/60 px-2.5 py-0.5 rounded-lg font-mono shadow-sm"
                      >
                        <span className="text-purple-400 font-bold">Extra:</span>
                        <span className="text-white">Remoção de peça</span>
                        <button
                          type="button"
                          onClick={handleToggleRemocaoPeca}
                          className="text-slate-400 hover:text-rose-300 ml-0.5 cursor-pointer"
                          title="Remover opção de remoção de peça"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </motion.span>
                    )}
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Navegação por Abas das 4 Categorias de Tuning */}
            <div className="flex items-center gap-1.5 bg-[#070b14] p-1 rounded-xl border border-[#1e293b]/80 relative">
              {TUNING_CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isActive = activeTuningTab === cat.id;
                const hasSelected = Boolean(tuningParts[cat.id]);

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      playChipSelectSound();
                      setActiveTuningTab(cat.id);
                    }}
                    className={`relative flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer z-10 ${
                      isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="tuningActiveTabIndicator"
                        className="absolute inset-0 bg-blue-600 rounded-lg shadow-md -z-10"
                        transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                      />
                    )}
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-blue-400'}`} />
                    <span>{cat.name}</span>
                    {hasSelected && (
                      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-amber-300' : 'bg-blue-400'}`} />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Grid de Opções da Categoria Ativa */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTuningTab}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.16 }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1"
              >
                {currentTuningCategory.items.map((item) => {
                  const isSelected = tuningParts[currentTuningCategory.id] === item.name;

                  return (
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectTuningPart(currentTuningCategory.id, item.name)}
                      className={`text-left p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
                        isSelected
                          ? 'bg-blue-950/80 border-blue-500 shadow-md ring-1 ring-blue-500/50'
                          : 'bg-[#111827] hover:bg-[#151f33] border-[#1e293b] hover:border-[#334155]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <span className={`text-xs font-bold leading-snug ${isSelected ? 'text-white font-sans' : 'text-slate-200'}`}>
                          {item.name}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-md border font-mono uppercase font-bold shrink-0 ${item.badgeColor}`}>
                          {item.badge}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-400 leading-tight">
                        {item.desc}
                      </p>

                      <div className="flex items-center justify-between pt-1.5 border-t border-[#1e293b]/50">
                        <span className="text-[10px] text-slate-400">Clique para {isSelected ? 'remover' : 'instalar'}</span>
                        <div
                          className={`w-4 h-4 rounded-md flex items-center justify-center border text-[10px] transition-colors ${
                            isSelected
                              ? 'bg-blue-600 border-blue-400 text-white'
                              : 'border-[#334155] bg-[#070b14] text-transparent'
                          }`}
                        >
                          ✓
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        )}

        {/* ======================= MODO 3: RETÍFICA DE MOTOR ======================= */}
        {serviceMode === 'retifica' && (
          <motion.div
            key="mode-retifica"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {/* Diagnósticos e Casos Rápidos de Retífica */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Cog className="w-3.5 h-3.5 text-rose-400" />
                  Diagnósticos Rápidos (1 Toque):
                </span>
                {activeRetificaCount > 0 && (
                  <button
                    type="button"
                    onClick={handleClearRetificaParts}
                    className="text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 px-2 py-0.5 rounded transition-colors cursor-pointer"
                  >
                    Limpar Retífica
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {RETIFICA_PRESETS.map((preset) => {
                  return (
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      key={preset.id}
                      type="button"
                      onClick={() => handleApplyRetificaPreset(preset)}
                      className="text-left p-2.5 rounded-xl bg-[#111827] border border-[#1e293b] hover:border-rose-700/60 hover:bg-[#1a1726] transition-all cursor-pointer flex flex-col justify-between space-y-1"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-white">
                          {preset.name}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-tight">
                        {preset.symptom}
                      </p>
                      <div className="pt-1 border-t border-[#1e293b]/60 flex items-center justify-between">
                        <span className="text-[10px] text-rose-400 font-mono">
                          {preset.rule}
                        </span>
                        <span className="text-[10px] text-blue-400 font-bold font-mono">Aplicar →</span>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Checklist de Componentes do Motor */}
            <div className="pt-2 border-t border-[#1e293b] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5 text-blue-400" />
                  Componentes de Motor & Origem:
                </span>
                {remocaoPeca && (
                  <span className="text-[10px] text-purple-300 bg-purple-950/80 border border-purple-700/60 px-2 py-0.5 rounded font-mono">
                    + Remoção de peça incluída
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {/* 1. Bloco do Motor (Com Seletor de Cilindros Inteligente) */}
                <div
                  onClick={() => handleToggleRetificaPart('bloco')}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-2 select-none ${
                    retificaParts.bloco
                      ? 'bg-rose-950/80 border-rose-500 text-white shadow-md ring-1 ring-rose-500/50'
                      : 'bg-[#111827] hover:bg-[#172033] border-[#1e293b] text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🧱</span>
                      <span className="text-xs font-bold">
                        {retificaParts.bloco && retificaParts.blocoCilindros !== 4
                          ? `Bloco (${retificaParts.blocoCilindros} cil)`
                          : 'Bloco do Motor'}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                        retificaParts.bloco ? 'bg-rose-600 text-white' : 'bg-[#070b14] text-slate-500'
                      }`}
                    >
                      {retificaParts.bloco ? 'SUBSTITUIR' : 'OK'}
                    </span>
                  </div>

                  {/* Seletor de Cilindros */}
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="pt-1.5 border-t border-[#1e293b]/60 flex items-center justify-between gap-1"
                  >
                    <span className="text-[10px] text-slate-400 font-bold uppercase font-mono">Cilindros:</span>
                    <div className="flex items-center gap-1 bg-[#070b14] px-1 py-0.5 rounded border border-[#1e293b]">
                      <button
                        type="button"
                        disabled={retificaParts.blocoCilindros <= 3}
                        onClick={(e) => handleChangeBlocoCilindros(-1, e)}
                        className="w-5 h-5 rounded flex items-center justify-center bg-[#162033] hover:bg-[#22314d] text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                        title="Diminuir cilindros"
                      >
                        <Minus className="w-3 h-3" />
                      </button>

                      <span className="text-xs font-mono font-bold px-1.5 text-rose-300">
                        {retificaParts.blocoCilindros}
                      </span>

                      <button
                        type="button"
                        disabled={retificaParts.blocoCilindros >= 16}
                        onClick={(e) => handleChangeBlocoCilindros(1, e)}
                        className="w-5 h-5 rounded flex items-center justify-center bg-[#162033] hover:bg-[#22314d] text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                        title="Aumentar cilindros"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* 2. Pistões */}
                <div
                  onClick={() => handleToggleRetificaPart('pistoes')}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-2 select-none ${
                    retificaParts.pistoes
                      ? 'bg-rose-950/80 border-rose-500 text-white shadow-md ring-1 ring-rose-500/50'
                      : 'bg-[#111827] hover:bg-[#172033] border-[#1e293b] text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">⚡</span>
                      <span className="text-xs font-bold">Pistões</span>
                    </div>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                        retificaParts.pistoes ? 'bg-rose-600 text-white' : 'bg-[#070b14] text-slate-500'
                      }`}
                    >
                      {retificaParts.pistoes ? 'SUBSTITUIR' : 'OK'}
                    </span>
                  </div>

                  {retificaParts.pistoes && (
                    <div className="pt-1.5 border-t border-[#1e293b]/60 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => handleChangePartOrigin('pistoesOrigem', 'mec', e)}
                        className={`flex-1 py-1 px-1.5 rounded text-[10px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                          retificaParts.pistoesOrigem === 'mec'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-[#070b14] text-slate-400 hover:text-white'
                        }`}
                      >
                        <Store className="w-3 h-3" />
                        <span>Original</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleChangePartOrigin('pistoesOrigem', 'cliente', e)}
                        className={`flex-1 py-1 px-1.5 rounded text-[10px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                          retificaParts.pistoesOrigem === 'cliente'
                            ? 'bg-amber-600 text-white shadow-sm'
                            : 'bg-[#070b14] text-slate-400 hover:text-white'
                        }`}
                      >
                        <UserCheck className="w-3 h-3" />
                        <span>Cliente</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* 3. Bielas */}
                <div
                  onClick={() => handleToggleRetificaPart('bielas')}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-2 select-none ${
                    retificaParts.bielas
                      ? 'bg-rose-950/80 border-rose-500 text-white shadow-md ring-1 ring-rose-500/50'
                      : 'bg-[#111827] hover:bg-[#172033] border-[#1e293b] text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🔩</span>
                      <span className="text-xs font-bold">Bielas</span>
                    </div>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                        retificaParts.bielas ? 'bg-rose-600 text-white' : 'bg-[#070b14] text-slate-500'
                      }`}
                    >
                      {retificaParts.bielas ? 'SUBSTITUIR' : 'OK'}
                    </span>
                  </div>

                  {retificaParts.bielas && (
                    <div className="pt-1.5 border-t border-[#1e293b]/60 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => handleChangePartOrigin('bielasOrigem', 'mec', e)}
                        className={`flex-1 py-1 px-1.5 rounded text-[10px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                          retificaParts.bielasOrigem === 'mec'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-[#070b14] text-slate-400 hover:text-white'
                        }`}
                      >
                        <Store className="w-3 h-3" />
                        <span>Original</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleChangePartOrigin('bielasOrigem', 'cliente', e)}
                        className={`flex-1 py-1 px-1.5 rounded text-[10px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                          retificaParts.bielasOrigem === 'cliente'
                            ? 'bg-amber-600 text-white shadow-sm'
                            : 'bg-[#070b14] text-slate-400 hover:text-white'
                        }`}
                      >
                        <UserCheck className="w-3 h-3" />
                        <span>Cliente</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* 4. Cabeçote */}
                <div
                  onClick={() => handleToggleRetificaPart('cabecote')}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-2 select-none ${
                    retificaParts.cabecote
                      ? 'bg-rose-950/80 border-rose-500 text-white shadow-md ring-1 ring-rose-500/50'
                      : 'bg-[#111827] hover:bg-[#172033] border-[#1e293b] text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🛠️</span>
                      <span className="text-xs font-bold">Cabeçote</span>
                    </div>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                        retificaParts.cabecote ? 'bg-rose-600 text-white' : 'bg-[#070b14] text-slate-500'
                      }`}
                    >
                      {retificaParts.cabecote ? 'SUBSTITUIR' : 'OK'}
                    </span>
                  </div>

                  {retificaParts.cabecote && (
                    <div className="pt-1.5 border-t border-[#1e293b]/60 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => handleChangePartOrigin('cabecoteOrigem', 'mec', e)}
                        className={`flex-1 py-1 px-1.5 rounded text-[10px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                          retificaParts.cabecoteOrigem === 'mec'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-[#070b14] text-slate-400 hover:text-white'
                        }`}
                      >
                        <Store className="w-3 h-3" />
                        <span>Original</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleChangePartOrigin('cabecoteOrigem', 'cliente', e)}
                        className={`flex-1 py-1 px-1.5 rounded text-[10px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                          retificaParts.cabecoteOrigem === 'cliente'
                            ? 'bg-amber-600 text-white shadow-sm'
                            : 'bg-[#070b14] text-slate-400 hover:text-white'
                        }`}
                      >
                        <UserCheck className="w-3 h-3" />
                        <span>Cliente</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* 5. Virabrequim */}
                <div
                  onClick={() => handleToggleRetificaPart('virabrequim')}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-2 select-none ${
                    retificaParts.virabrequim
                      ? 'bg-rose-950/80 border-rose-500 text-white shadow-md ring-1 ring-rose-500/50'
                      : 'bg-[#111827] hover:bg-[#172033] border-[#1e293b] text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🔄</span>
                      <span className="text-xs font-bold">Virabrequim</span>
                    </div>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                        retificaParts.virabrequim ? 'bg-rose-600 text-white' : 'bg-[#070b14] text-slate-500'
                      }`}
                    >
                      {retificaParts.virabrequim ? 'SUBSTITUIR' : 'OK'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">Em caso de motor travado ou folga</p>
                </div>

                {/* 6. Cilindros */}
                <div
                  onClick={() => handleToggleRetificaPart('cilindros')}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-2 select-none ${
                    retificaParts.cilindros
                      ? 'bg-rose-950/80 border-rose-500 text-white shadow-md ring-1 ring-rose-500/50'
                      : 'bg-[#111827] hover:bg-[#172033] border-[#1e293b] text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🕳️</span>
                      <span className="text-xs font-bold">Cilindros</span>
                    </div>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                        retificaParts.cilindros ? 'bg-rose-600 text-white' : 'bg-[#070b14] text-slate-500'
                      }`}
                    >
                      {retificaParts.cilindros ? 'SUBSTITUIR' : 'OK'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">Brunimento / Retífica de camisas</p>
                </div>

                {/* 7. Turbina */}
                <div
                  onClick={() => handleToggleRetificaPart('turbina')}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-2 select-none ${
                    retificaParts.turbina
                      ? 'bg-rose-950/80 border-rose-500 text-white shadow-md ring-1 ring-rose-500/50'
                      : 'bg-[#111827] hover:bg-[#172033] border-[#1e293b] text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🌀</span>
                      <span className="text-xs font-bold">Turbina</span>
                    </div>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                        retificaParts.turbina ? 'bg-rose-600 text-white' : 'bg-[#070b14] text-slate-500'
                      }`}
                    >
                      {retificaParts.turbina ? 'SUBSTITUIR' : 'OK'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">Troca em caso de fumaça no escape</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ======================= MODO 4: ABA EXTRA ======================= */}
        {serviceMode === 'extra' && (
          <motion.div
            key="mode-extra"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {/* Card Principal: Remoção de Peça */}
            <div className="bg-[#0f172a] border border-purple-900/40 rounded-xl p-4 sm:p-5 flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-purple-950/80 border border-purple-700/60 flex items-center justify-center shrink-0">
                  <PackageMinus className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm sm:text-base font-bold text-white uppercase tracking-wider">
                      Remoção de Peça
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-950/80 text-purple-300 border border-purple-800/60 font-mono">
                      Multi-Aba
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 max-w-xl leading-relaxed">
                    Desinstalação de peças do veículo. Esta é a <strong>única opção</strong> que pode ser combinada livremente com qualquer outra aba (Troca de Óleo, Tuning ou Retífica) ou ser utilizada de forma avulsa.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  type="button"
                  onClick={handleToggleRemocaoPeca}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer font-mono flex items-center gap-1.5 shadow-md ${
                    remocaoPeca
                      ? 'bg-purple-600 border-purple-400 text-white shadow-purple-900/40'
                      : 'bg-[#111827] border-[#1e293b] text-slate-300 hover:text-white hover:bg-[#162033]'
                  }`}
                >
                  {remocaoPeca ? (
                    <>
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>Remoção Ativa</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Ativar Remoção</span>
                    </>
                  )}
                </motion.button>
              </div>
            </div>

            {/* Aviso Informativo e Status Atual */}
            <div className="p-3 bg-[#070b14] border border-[#1e293b] rounded-xl flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-slate-400">
                <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
                <span>
                  Status do serviço atual na ficha: <strong className="text-white font-mono">{currentServico}</strong>
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

PartsSelector.displayName = 'PartsSelector';

