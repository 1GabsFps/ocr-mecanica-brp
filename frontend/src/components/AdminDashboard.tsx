import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldAlert,
  X,
  RefreshCw,
  Download,
  Lock,
  Unlock,
  Clock,
  TrendingUp,
  Activity,
  Zap,
  Wrench,
  Droplets,
  PackageMinus,
  CheckCircle2,
  AlertTriangle,
  Search,
  Award,
  Users,
  BarChart3,
  FileText,
  Flame,
  UserCheck,
  RotateCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { playChipSelectSound } from '../utils/soundEffects';

interface AdminSummary {
  totalToday: number;
  totalWeek: number;
  successRate: number;
  avgDurationSec: number;
  fastestDurationSec: number;
}

interface ServiceBreakdown {
  oleo: number;
  tuning: number;
  retifica: number;
  extra: number;
}

interface HourlyData {
  hour: string;
  count: number;
}

export interface MechanicRankingItem {
  steamHex: string;
  nome: string;
  avatarUrl: string;
  totalFichas: number;
  totalOleo: number;
  totalTuning: number;
  totalRetifica: number;
  totalExtra: number;
  hojeFichas: number;
  semanaFichas: number;
}

export interface FuncionarioItem {
  steamHex: string;
  nome: string;
  avatarUrl: string;
  ativo: boolean;
  lastSyncedAt: number;
}

interface ExtractionLog {
  id: number;
  timestamp: number;
  dateTimeStr: string;
  success: boolean;
  durationMs: number;
  durationSec: number;
  model: string;
  placa: string;
  modelo: string;
  servico: string;
  serviceMode: string;
  mechanicName?: string;
  mechanicSteamHex?: string;
}

export interface AdminDashboardData {
  summary: AdminSummary;
  serviceBreakdown: ServiceBreakdown;
  modelBreakdown: Record<string, number>;
  hourly: HourlyData[];
  ranking: MechanicRankingItem[];
  funcionarios: FuncionarioItem[];
  recentLogs: ExtractionLog[];
}

interface AdminDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

const AUTH_STORAGE_KEY = 'mec_admin_auth_token';
const SECRET_STORAGE_KEY = 'mec_admin_secret_token';

type AdminTab = 'kpis' | 'ranking' | 'logs' | 'funcionarios';
type RankingPeriod = 'hoje' | 'semana' | 'geral';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ isOpen, onClose }) => {
  const [password, setPassword] = useState('');
  const [adminSecret, setAdminSecret] = useState<string>(() => {
    return sessionStorage.getItem(SECRET_STORAGE_KEY) || '';
  });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem(AUTH_STORAGE_KEY) === 'true';
  });
  const [adminData, setAdminData] = useState<AdminDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncingMembers, setIsSyncingMembers] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [rankingSearch, setRankingSearch] = useState('');
  const [funcSearch, setFuncSearch] = useState('');
  const [selectedTab, setSelectedTab] = useState<AdminTab>('kpis');
  const [rankingPeriod, setRankingPeriod] = useState<RankingPeriod>('geral');
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; hour: string; count: number } | null>(null);

  const fetchAdminData = useCallback(async (secret: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/telemetry/admin?secret=${encodeURIComponent(secret)}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });

      if (res.status === 401) {
        setIsAuthenticated(false);
        sessionStorage.removeItem(AUTH_STORAGE_KEY);
        sessionStorage.removeItem(SECRET_STORAGE_KEY);
        setAdminSecret('');
        toast.error('Senha de administrador incorreta.');
        return;
      }

      if (!res.ok) {
        throw new Error('Falha ao carregar dados do servidor');
      }

      const data: AdminDashboardData = await res.json();
      setAdminData(data);
      setIsAuthenticated(true);
      sessionStorage.setItem(AUTH_STORAGE_KEY, 'true');
      sessionStorage.setItem(SECRET_STORAGE_KEY, secret);
    } catch (err: any) {
      toast.error('Erro de conexão com o microsserviço de telemetria.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleManualSyncMembers = useCallback(async () => {
    if (!adminSecret) return;
    setIsSyncingMembers(true);
    try {
      const res = await fetch('/api/telemetry/admin/sync-funcionarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: adminSecret }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Quadro sincronizado com sucesso!`, {
          description: `${data.total} funcionários atualizados da API Netlify.`,
        });
        fetchAdminData(adminSecret);
      } else {
        toast.error('Falha ao sincronizar com a API Netlify.');
      }
    } catch (_) {
      toast.error('Erro ao conectar com servidor de sincronização.');
    } finally {
      setIsSyncingMembers(false);
    }
  }, [adminSecret, fetchAdminData]);

  useEffect(() => {
    if (isOpen && adminSecret) {
      fetchAdminData(adminSecret);
    }
  }, [isOpen, adminSecret, fetchAdminData]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setAdminSecret(password.trim());
    fetchAdminData(password.trim());
  };

  const handleLogout = () => {
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    sessionStorage.removeItem(SECRET_STORAGE_KEY);
    setIsAuthenticated(false);
    setAdminSecret('');
    setAdminData(null);
    setPassword('');
    toast.info('Sessão administrativa encerrada.');
  };

  // Filtragem dos Logs
  const filteredLogs = useMemo(() => {
    if (!adminData?.recentLogs) return [];
    if (!searchTerm.trim()) return adminData.recentLogs;

    const term = searchTerm.toLowerCase();
    return adminData.recentLogs.filter(
      (log) =>
        log.placa.toLowerCase().includes(term) ||
        log.modelo.toLowerCase().includes(term) ||
        log.servico.toLowerCase().includes(term) ||
        log.model.toLowerCase().includes(term) ||
        (log.mechanicName && log.mechanicName.toLowerCase().includes(term))
    );
  }, [adminData?.recentLogs, searchTerm]);

  // Filtragem e Ordenação do Ranking de Mecânicos
  const filteredRanking = useMemo(() => {
    if (!adminData?.ranking) return [];
    let list = [...adminData.ranking];

    if (rankingPeriod === 'hoje') {
      list.sort((a, b) => b.hojeFichas - a.hojeFichas);
    } else if (rankingPeriod === 'semana') {
      list.sort((a, b) => b.semanaFichas - a.semanaFichas);
    } else {
      list.sort((a, b) => b.totalFichas - a.totalFichas);
    }

    if (rankingSearch.trim()) {
      const term = rankingSearch.toLowerCase();
      list = list.filter(
        (m) =>
          m.nome.toLowerCase().includes(term) ||
          m.steamHex.toLowerCase().includes(term)
      );
    }

    return list;
  }, [adminData?.ranking, rankingPeriod, rankingSearch]);

  // Filtragem do Quadro de Funcionários
  const filteredFuncionarios = useMemo(() => {
    if (!adminData?.funcionarios) return [];
    if (!funcSearch.trim()) return adminData.funcionarios;

    const term = funcSearch.toLowerCase();
    return adminData.funcionarios.filter(
      (f) =>
        f.nome.toLowerCase().includes(term) ||
        f.steamHex.toLowerCase().includes(term)
    );
  }, [adminData?.funcionarios, funcSearch]);

  // Total geral de fichas para cálculo de participação %
  const totalFichasGeral = useMemo(() => {
    if (!adminData?.ranking) return 0;
    return adminData.ranking.reduce((acc, m) => acc + m.totalFichas, 0);
  }, [adminData?.ranking]);

  // Cálculo da Curva Bézier 24 Horas
  const { chartPoints, linePath, areaPath, maxHourlyCount, peakPoint } = useMemo(() => {
    const hourly = adminData?.hourly || [];
    const maxVal = Math.max(...hourly.map((h) => h.count), 1);

    const svgWidth = 800;
    const svgHeight = 170;
    const paddingX = 35;
    const paddingTop = 38;
    const paddingBottom = 32;
    const usableWidth = svgWidth - paddingX * 2;
    const usableHeight = svgHeight - paddingTop - paddingBottom;

    const points = hourly.map((h, i) => {
      const x = paddingX + (i / Math.max(hourly.length - 1, 1)) * usableWidth;
      const y = svgHeight - paddingBottom - (h.count / maxVal) * usableHeight;
      return { x, y, count: h.count, hour: h.hour };
    });

    let peak = points[0] || { x: 0, y: 0, count: 0, hour: '00:00' };
    points.forEach((pt) => {
      if (pt.count > peak.count) peak = pt;
    });

    if (points.length === 0) {
      return { chartPoints: [], linePath: '', areaPath: '', maxHourlyCount: 0, peakPoint: peak };
    }

    let d = `M ${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? 0 : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
    }

    const baselineY = svgHeight - paddingBottom;
    const area = `${d} L ${points[points.length - 1].x},${baselineY} L ${points[0].x},${baselineY} Z`;

    return { chartPoints: points, linePath: d, areaPath: area, maxHourlyCount: maxVal, peakPoint: peak };
  }, [adminData?.hourly]);

  const handleExportCSV = () => {
    if (!adminData?.recentLogs || adminData.recentLogs.length === 0) {
      toast.error('Nenhum dado disponível para exportação.');
      return;
    }

    const headers = ['ID', 'Data/Hora', 'Mecânico', 'SteamHex', 'Sucesso', 'Duracao_ms', 'Duracao_s', 'IA_Model', 'Placa', 'Modelo_Carro', 'Servico', 'Modo_Servico'];
    const rows = adminData.recentLogs.map((l) => [
      l.id,
      `"${l.dateTimeStr}"`,
      `"${l.mechanicName || 'Anônimo'}"`,
      `"${l.mechanicSteamHex || ''}"`,
      l.success ? 'SIM' : 'NAO',
      l.durationMs,
      l.durationSec,
      `"${l.model}"`,
      `"${l.placa}"`,
      `"${l.modelo}"`,
      `"${l.servico}"`,
      `"${l.serviceMode}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `telemetria_mecanica_brp_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Arquivo CSV baixado com sucesso!');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-xl overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="relative w-full max-w-6xl bg-[#090d16] border border-slate-800/90 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Glow Superior */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-48 bg-blue-600/10 rounded-full blur-3xl pointer-events-none -z-10" />

        {/* Header Principal do Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-900/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shadow-[0_0_15px_rgba(37,99,235,0.2)]">
              <ShieldAlert className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white uppercase tracking-wider">
                  Painel de Controle & Telemetria
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  MECÂNICA BRP
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Auditoria de OCR, Ranking de Produtividade e Quadro de Funcionários
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAuthenticated && (
              <>
                <button
                  type="button"
                  onClick={() => fetchAdminData(adminSecret)}
                  disabled={isLoading}
                  className="p-2 rounded-lg bg-slate-800/70 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-colors"
                  title="Atualizar dados"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-400' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/70 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 text-xs font-semibold transition-colors"
                  title="Exportar dados para planilha CSV"
                >
                  <Download className="w-3.5 h-3.5 text-blue-400" />
                  <span className="hidden sm:inline">CSV</span>
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="p-2 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 transition-colors"
                  title="Encerrar sessão de admin"
                >
                  <Unlock className="w-4 h-4" />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800/40 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors"
              title="Fechar painel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Conteúdo do Modal */}
        {!isAuthenticated ? (
          /* TELA DE AUTENTICAÇÃO COM SENHA MASTER */
          <div className="flex-1 flex flex-col items-center justify-center p-8 sm:p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-4 shadow-xl">
              <Lock className="w-8 h-8 text-blue-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Acesso Administrativo</h3>
            <p className="text-xs text-slate-400 max-w-sm mb-6">
              Insira a senha mestra para visualizar KPIs de atendimento, ranking dos mecânicos e quadro de funcionários.
            </p>

            <form onSubmit={handleLogin} className="w-full max-w-xs space-y-3">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Senha Master"
                autoFocus
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 transition-colors text-center tracking-widest font-mono"
              />
              <button
                type="submit"
                disabled={isLoading || !password.trim()}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-sm shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verificando...</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-4 h-4" />
                    <span>Desbloquear Painel</span>
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          /* PAINEL ADMINISTRATIVO MODULAR COM 4 ABAS */
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Barra de Navegação por Abas (Alta Densidade) */}
            <div className="px-6 pt-3 pb-0 border-b border-slate-800/80 bg-slate-900/40 flex items-center gap-2 overflow-x-auto shrink-0 no-scrollbar">
              <button
                type="button"
                onClick={() => {
                  playChipSelectSound();
                  setSelectedTab('kpis');
                }}
                className={`flex items-center gap-2 px-4 py-2.5 border-b-2 font-bold text-xs tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                  selectedTab === 'kpis'
                    ? 'border-blue-500 text-blue-400 bg-blue-500/10 rounded-t-lg'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 rounded-t-lg'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>1. VISÃO GERAL</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  playChipSelectSound();
                  setSelectedTab('ranking');
                }}
                className={`flex items-center gap-2 px-4 py-2.5 border-b-2 font-bold text-xs tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                  selectedTab === 'ranking'
                    ? 'border-blue-500 text-blue-400 bg-blue-500/10 rounded-t-lg'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 rounded-t-lg'
                }`}
              >
                <Award className="w-4 h-4 text-amber-400" />
                <span>2. RANKING DE MECÂNICOS</span>
                {adminData?.ranking && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/20 text-amber-300 font-mono">
                    {adminData.ranking.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  playChipSelectSound();
                  setSelectedTab('logs');
                }}
                className={`flex items-center gap-2 px-4 py-2.5 border-b-2 font-bold text-xs tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                  selectedTab === 'logs'
                    ? 'border-blue-500 text-blue-400 bg-blue-500/10 rounded-t-lg'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 rounded-t-lg'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>3. FICHAS & LOGS</span>
                {adminData?.recentLogs && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-500/20 text-blue-300 font-mono">
                    {adminData.recentLogs.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  playChipSelectSound();
                  setSelectedTab('funcionarios');
                }}
                className={`flex items-center gap-2 px-4 py-2.5 border-b-2 font-bold text-xs tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                  selectedTab === 'funcionarios'
                    ? 'border-blue-500 text-blue-400 bg-blue-500/10 rounded-t-lg'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 rounded-t-lg'
                }`}
              >
                <Users className="w-4 h-4 text-emerald-400" />
                <span>4. QUADRO DA MECÂNICA</span>
                {adminData?.funcionarios && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 font-mono">
                    {adminData.funcionarios.length}
                  </span>
                )}
              </button>
            </div>

            {/* Conteúdo Rolável da Aba Ativa */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* ========================================================================= */}
              {/* ABA 1: VISÃO GERAL & KPIS */}
              {/* ========================================================================= */}
              {selectedTab === 'kpis' && (
                <div className="space-y-6">
                  {/* Grid de 4 Cards Principais */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-slate-400 font-medium">Atendimentos Hoje</span>
                        <Activity className="w-4 h-4 text-blue-400" />
                      </div>
                      <div className="text-2xl font-black text-white font-mono">
                        {adminData?.summary.totalToday ?? 0}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        Esta semana: <span className="font-bold text-slate-300 font-mono">{adminData?.summary.totalWeek ?? 0}</span>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-slate-400 font-medium">Taxa de Sucesso</span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div className="text-2xl font-black text-emerald-400 font-mono">
                        {adminData?.summary.successRate ?? 100}%
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        100% de leitura válida
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-slate-400 font-medium">Tempo Médio OCR</span>
                        <Clock className="w-4 h-4 text-amber-400" />
                      </div>
                      <div className="text-2xl font-black text-amber-400 font-mono">
                        {adminData?.summary.avgDurationSec ?? 1.4}s
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        Mais rápido: <span className="font-bold text-emerald-400 font-mono">{adminData?.summary.fastestDurationSec ?? 1.1}s</span>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-slate-400 font-medium">Horário de Pico</span>
                        <TrendingUp className="w-4 h-4 text-indigo-400" />
                      </div>
                      <div className="text-2xl font-black text-indigo-300 font-mono">
                        {peakPoint.count > 0 ? peakPoint.hour : '--:--'}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        Volume máx: <span className="font-bold text-slate-300 font-mono">{peakPoint.count} fichas</span>
                      </div>
                    </div>
                  </div>

                  {/* Gráfico Curva Neon de Horários de Pico (24h) */}
                  <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-blue-400" />
                        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                          Curva de Atendimentos nas Últimas 24 Horas
                        </h4>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">00:00 às 23:00 (BRT)</span>
                    </div>

                    <div className="relative w-full h-48 bg-slate-950/70 border border-slate-800/70 rounded-xl p-2 select-none">
                      <svg viewBox="0 0 800 170" preserveAspectRatio="none" className="w-full h-full">
                        <defs>
                          <linearGradient id="adminPeakLine" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#3b82f6" />
                            <stop offset="50%" stopColor="#06b6d4" />
                            <stop offset="100%" stopColor="#6366f1" />
                          </linearGradient>
                          <linearGradient id="adminPeakArea" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
                            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                          </linearGradient>
                          <filter id="adminGlow" x="-20%" y="-20%" width="140%" height="140%">
                            <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#38bdf8" floodOpacity="0.6" />
                          </filter>
                        </defs>

                        {/* Grid Horizontal */}
                        <line x1="35" y1="38" x2="765" y2="38" stroke="#334155" strokeDasharray="3 3" strokeOpacity="0.35" />
                        <line x1="35" y1="88" x2="765" y2="88" stroke="#334155" strokeDasharray="3 3" strokeOpacity="0.35" />
                        <line x1="35" y1="138" x2="765" y2="138" stroke="#334155" strokeOpacity="0.6" />

                        {/* Ticks de Horário no Eixo X */}
                        <g className="text-[9px] fill-slate-500 font-mono select-none" textAnchor="middle">
                          <text x="35" y="156">00:00</text>
                          <text x="160" y="156">04:00</text>
                          <text x="290" y="156">08:00</text>
                          <text x="415" y="156">12:00</text>
                          <text x="545" y="156">16:00</text>
                          <text x="670" y="156">20:00</text>
                          <text x="765" y="156">23:00</text>
                        </g>

                        {/* Área Sombreada */}
                        {areaPath && <path d={areaPath} fill="url(#adminPeakArea)" />}

                        {/* Linha Contínua */}
                        {linePath && (
                          <path
                            d={linePath}
                            fill="none"
                            stroke="url(#adminPeakLine)"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            filter="url(#adminGlow)"
                          />
                        )}

                        {/* Ponto de Pico */}
                        {peakPoint.count > 0 && (
                          <g>
                            <circle cx={peakPoint.x} cy={peakPoint.y} r="6" fill="#38bdf8" opacity="0.3" />
                            <circle cx={peakPoint.x} cy={peakPoint.y} r="4" fill="#ffffff" stroke="#0284c7" strokeWidth="2" />
                          </g>
                        )}

                        {/* Pontos Interativos */}
                        {chartPoints.map((pt, i) => (
                          <circle
                            key={i}
                            cx={pt.x}
                            cy={pt.y}
                            r={hoveredPoint?.hour === pt.hour ? 5.5 : 2.5}
                            fill={hoveredPoint?.hour === pt.hour ? '#ffffff' : '#38bdf8'}
                            stroke="#0f172a"
                            strokeWidth="1.5"
                            className="cursor-pointer transition-all"
                            onMouseEnter={() => setHoveredPoint(pt)}
                            onMouseLeave={() => setHoveredPoint(null)}
                          />
                        ))}
                      </svg>

                      {/* Tooltip Dinâmico Inteligente (Sem Clipping de Topo/Laterais) */}
                      {hoveredPoint && (
                        <div
                          className="absolute pointer-events-none z-30 px-2.5 py-1.5 rounded-lg bg-slate-900/95 border border-cyan-500/60 shadow-2xl text-center backdrop-blur-md transition-transform duration-75"
                          style={{
                            left: `${Math.min(91, Math.max(9, (hoveredPoint.x / 800) * 100))}%`,
                            top: `${(hoveredPoint.y / 170) * 100}%`,
                            transform: hoveredPoint.y < 70 ? 'translate(-50%, 14px)' : 'translate(-50%, calc(-100% - 12px))',
                          }}
                        >
                          <div className="text-[10px] font-mono text-cyan-300 font-bold leading-tight">{hoveredPoint.hour}</div>
                          <div className="text-xs font-black text-white leading-tight">{hoveredPoint.count} {hoveredPoint.count === 1 ? 'ficha' : 'fichas'}</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Divisão por Categoria de Serviço */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-800/80 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                        <Droplets className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400 block">Troca de Óleo</span>
                        <span className="text-base font-bold text-white font-mono">{adminData?.serviceBreakdown.oleo ?? 0}</span>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-800/80 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                        <Zap className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400 block">Tuning / Peças</span>
                        <span className="text-base font-bold text-white font-mono">{adminData?.serviceBreakdown.tuning ?? 0}</span>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-800/80 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center">
                        <Wrench className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400 block">Retífica de Motor</span>
                        <span className="text-base font-bold text-white font-mono">{adminData?.serviceBreakdown.retifica ?? 0}</span>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-800/80 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                        <PackageMinus className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400 block">Remoção de Peça</span>
                        <span className="text-base font-bold text-white font-mono">{adminData?.serviceBreakdown.extra ?? 0}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================================= */}
              {/* ABA 2: RANKING DE MECÂNICOS & PRODUTIVIDADE */}
              {/* ========================================================================= */}
              {selectedTab === 'ranking' && (
                <div className="space-y-4">
                  {/* Barra de Filtro de Período & Busca */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                    <div className="flex items-center gap-1.5 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => setRankingPeriod('hoje')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          rankingPeriod === 'hoje'
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-slate-800/60 text-slate-400 hover:text-white'
                        }`}
                      >
                        Hoje (Turno)
                      </button>
                      <button
                        type="button"
                        onClick={() => setRankingPeriod('semana')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          rankingPeriod === 'semana'
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-slate-800/60 text-slate-400 hover:text-white'
                        }`}
                      >
                        Últimos 7 Dias
                      </button>
                      <button
                        type="button"
                        onClick={() => setRankingPeriod('geral')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          rankingPeriod === 'geral'
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-slate-800/60 text-slate-400 hover:text-white'
                        }`}
                      >
                        Geral (Total)
                      </button>
                    </div>

                    <div className="relative w-full sm:w-64">
                      <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={rankingSearch}
                        onChange={(e) => setRankingSearch(e.target.value)}
                        placeholder="Buscar mecânico..."
                        className="w-full pl-9 pr-3 py-1.5 bg-slate-950/80 border border-slate-700/80 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Tabela de Produtividade dos Mecânicos */}
                  <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-900/90 text-slate-400 uppercase tracking-wider font-mono text-[11px] border-b border-slate-800">
                          <tr>
                            <th className="py-3 px-3 w-12 text-center">#</th>
                            <th className="py-3 px-4">Mecânico</th>
                            <th className="py-3 px-3 text-center">Total Fichas</th>
                            <th className="py-3 px-3 text-center text-amber-400">🛢️ Óleo</th>
                            <th className="py-3 px-3 text-center text-blue-400">⚡ Tuning</th>
                            <th className="py-3 px-3 text-center text-purple-400">🔧 Retífica</th>
                            <th className="py-3 px-3 text-center text-cyan-400">📦 Remoção</th>
                            <th className="py-3 px-4 text-right">Participação</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 text-slate-300">
                          {filteredRanking.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="py-8 text-center text-slate-500">
                                Nenhum atendimento computado para mecânicos no período selecionado.
                              </td>
                            </tr>
                          ) : (
                            filteredRanking.map((m, idx) => {
                              const totalPeriod =
                                rankingPeriod === 'hoje'
                                  ? m.hojeFichas
                                  : rankingPeriod === 'semana'
                                  ? m.semanaFichas
                                  : m.totalFichas;
                              const sharePct =
                                totalFichasGeral > 0
                                  ? Math.round((m.totalFichas / totalFichasGeral) * 100)
                                  : 0;

                              return (
                                <tr key={m.steamHex} className="hover:bg-slate-900/40 transition-colors">
                                  {/* Coluna 1: Posição */}
                                  <td className="py-3 px-3 text-center font-bold font-mono">
                                    {idx === 0 ? (
                                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_8px_rgba(245,158,11,0.3)]">
                                        🥇
                                      </span>
                                    ) : idx === 1 ? (
                                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-300/20 text-slate-200 border border-slate-300/40">
                                        🥈
                                      </span>
                                    ) : idx === 2 ? (
                                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-700/20 text-amber-400 border border-amber-700/40">
                                        🥉
                                      </span>
                                    ) : (
                                      <span className="text-slate-500">{idx + 1}º</span>
                                    )}
                                  </td>

                                  {/* Coluna 2: Avatar & Nome */}
                                  <td className="py-3 px-4">
                                    <div className="flex items-center gap-3">
                                      {m.avatarUrl ? (
                                        <img
                                          src={m.avatarUrl}
                                          alt={m.nome}
                                          className="w-8 h-8 rounded-full ring-1 ring-blue-500/40 object-cover shrink-0"
                                        />
                                      ) : (
                                        <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                                          <UserCheck className="w-4 h-4 text-slate-400" />
                                        </div>
                                      )}
                                      <div>
                                        <span className="font-bold text-white text-xs block">{m.nome}</span>
                                        <span className="text-[10px] font-mono text-slate-500">{m.steamHex}</span>
                                      </div>
                                    </div>
                                  </td>

                                  {/* Coluna 3: Total */}
                                  <td className="py-3 px-3 text-center">
                                    <span className="px-2.5 py-1 rounded-md bg-blue-600/20 text-blue-300 font-black font-mono border border-blue-500/30 text-xs">
                                      {totalPeriod}
                                    </span>
                                  </td>

                                  {/* Coluna 4: Óleo */}
                                  <td className="py-3 px-3 text-center font-mono font-bold text-amber-300">
                                    {m.totalOleo}
                                  </td>

                                  {/* Coluna 5: Tuning */}
                                  <td className="py-3 px-3 text-center font-mono font-bold text-blue-300">
                                    {m.totalTuning}
                                  </td>

                                  {/* Coluna 6: Retífica */}
                                  <td className="py-3 px-3 text-center font-mono font-bold text-purple-300">
                                    {m.totalRetifica}
                                  </td>

                                  {/* Coluna 7: Remoção */}
                                  <td className="py-3 px-3 text-center font-mono font-bold text-cyan-300">
                                    {m.totalExtra}
                                  </td>

                                  {/* Coluna 8: Participação */}
                                  <td className="py-3 px-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      <span className="font-mono text-xs text-slate-400 font-bold">{sharePct}%</span>
                                      <div className="w-16 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${sharePct}%` }} />
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================================= */}
              {/* ABA 3: FICHAS & LOGS DETALHADOS */}
              {/* ========================================================================= */}
              {selectedTab === 'logs' && (
                <div className="space-y-4">
                  {/* Busca Rápida nos Logs */}
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Filtrar por placa, modelo, serviço ou mecânico..."
                        className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Tabela de Logs */}
                  <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-900/90 text-slate-400 uppercase tracking-wider font-mono text-[10px] border-b border-slate-800">
                          <tr>
                            <th className="py-2.5 px-3">Data/Hora</th>
                            <th className="py-2.5 px-3">Mecânico</th>
                            <th className="py-2.5 px-3">Placa</th>
                            <th className="py-2.5 px-3">Veículo</th>
                            <th className="py-2.5 px-3">Serviço</th>
                            <th className="py-2.5 px-3">IA / Latência</th>
                            <th className="py-2.5 px-3 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 text-slate-300">
                          {filteredLogs.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="py-6 text-center text-slate-500">
                                Nenhum registro encontrado.
                              </td>
                            </tr>
                          ) : (
                            filteredLogs.map((log) => (
                              <tr key={log.id} className="hover:bg-slate-900/40 transition-colors font-mono text-[11px]">
                                <td className="py-2.5 px-3 text-slate-400">{log.dateTimeStr}</td>
                                <td className="py-2.5 px-3 font-semibold text-slate-200">{log.mechanicName || 'Anônimo'}</td>
                                <td className="py-2.5 px-3 font-bold text-amber-300">{log.placa}</td>
                                <td className="py-2.5 px-3 text-white truncate max-w-[130px]" title={log.modelo}>{log.modelo}</td>
                                <td className="py-2.5 px-3 text-slate-300 truncate max-w-[150px]" title={log.servico}>{log.servico}</td>
                                <td className="py-2.5 px-3 text-slate-400">
                                  <span>{log.model.replace('gemini-', '').replace('cloudflare-', '')}</span>
                                  <span className="text-blue-400 ml-1.5 font-bold">({log.durationSec}s)</span>
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  {log.success ? (
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                                      OK
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-bold">
                                      ERRO
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================================= */}
              {/* ABA 4: QUADRO DE FUNCIONÁRIOS (Sincronizado da API Netlify) */}
              {/* ========================================================================= */}
              {selectedTab === 'funcionarios' && (
                <div className="space-y-4">
                  {/* Barra de Ação & Sincronização */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800/80">
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <Users className="w-4 h-4 text-emerald-400" />
                        Quadro Oficial de Mecânicos Autorizados
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Base sincronizada com a API externa da Mecânica BRP ({adminData?.funcionarios.length || 0} membros ativos)
                      </p>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={handleManualSyncMembers}
                        disabled={isSyncingMembers}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <RotateCw className={`w-3.5 h-3.5 ${isSyncingMembers ? 'animate-spin' : ''}`} />
                        <span>{isSyncingMembers ? 'Sincronizando...' : 'Sincronizar com API Netlify'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Campo de Busca nos Membros */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={funcSearch}
                      onChange={(e) => setFuncSearch(e.target.value)}
                      placeholder="Buscar funcionário por nome ou Steam Hex..."
                      className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Grid de Membros Autorizados */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[50vh] overflow-y-auto pr-1">
                    {filteredFuncionarios.length === 0 ? (
                      <div className="col-span-full py-8 text-center text-slate-500 text-xs">
                        Nenhum funcionário encontrado com o termo pesquisado.
                      </div>
                    ) : (
                      filteredFuncionarios.map((func) => (
                        <div
                          key={func.steamHex}
                          className="p-3 rounded-xl bg-slate-900/50 border border-slate-800/80 flex items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {func.avatarUrl ? (
                              <img
                                src={func.avatarUrl}
                                alt={func.nome}
                                className="w-8 h-8 rounded-full ring-1 ring-emerald-500/40 object-cover shrink-0"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                                <UserCheck className="w-4 h-4 text-emerald-400" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <span className="font-bold text-white text-xs block truncate" title={func.nome}>
                                {func.nome}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400 block truncate" title={func.steamHex}>
                                {func.steamHex}
                              </span>
                            </div>
                          </div>

                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                            ATIVO
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};
