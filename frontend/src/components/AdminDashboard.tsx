import React, { useState, useEffect, useCallback } from 'react';
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

interface AdminLogItem {
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
}

interface AdminDashboardData {
  summary: AdminSummary;
  serviceBreakdown: {
    oleo: number;
    tuning: number;
    retifica: number;
    extra: number;
  };
  modelBreakdown: Record<string, number>;
  hourly: Array<{ hour: string; count: number }>;
  recentLogs: AdminLogItem[];
}

interface AdminDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

const AUTH_STORAGE_KEY = 'mec_admin_auth_token';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ isOpen, onClose }) => {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem(AUTH_STORAGE_KEY) === 'true';
  });
  const [adminData, setAdminData] = useState<AdminDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTab, setSelectedTab] = useState<'kpis' | 'logs'>('kpis');

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
        toast.error('Senha de administrador incorreta.');
        return;
      }

      if (!res.ok) {
        throw new Error('Falha na resposta do servidor.');
      }

      const data: AdminDashboardData = await res.json();
      setAdminData(data);
      setIsAuthenticated(true);
      sessionStorage.setItem(AUTH_STORAGE_KEY, 'true');
    } catch (err: any) {
      toast.error('Erro ao carregar telemetria da VPS: ' + (err.message || ''));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && isAuthenticated) {
      fetchAdminData('neco2026');
    }
  }, [isOpen, isAuthenticated, fetchAdminData]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      toast.warning('Digite a senha mestra.');
      return;
    }
    fetchAdminData(password.trim());
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    setPassword('');
    setAdminData(null);
    toast.info('Sessão administrativa encerrada.');
  };

  const handleExportCSV = () => {
    if (!adminData || !adminData.recentLogs.length) {
      toast.info('Sem dados para exportar.');
      return;
    }

    const headers = ['ID', 'Data/Hora', 'Placa', 'Modelo', 'Servico', 'Modo', 'IA Provedor', 'Duracao (s)', 'Status'];
    const rows = adminData.recentLogs.map((log) => [
      log.id,
      `"${log.dateTimeStr}"`,
      `"${log.placa}"`,
      `"${log.modelo}"`,
      `"${log.servico}"`,
      `"${log.serviceMode}"`,
      `"${log.model}"`,
      log.durationSec,
      log.success ? 'Sucesso' : 'Falha',
    ]);

    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `telemetria_mecanica_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Relatório CSV baixado com sucesso!');
  };

  if (!isOpen) return null;

  const filteredLogs = (adminData?.recentLogs || []).filter((log) => {
    const q = searchTerm.toLowerCase();
    return (
      log.placa.toLowerCase().includes(q) ||
      log.modelo.toLowerCase().includes(q) ||
      log.servico.toLowerCase().includes(q) ||
      log.model.toLowerCase().includes(q)
    );
  });

  const totalServicesCount =
    (adminData?.serviceBreakdown.oleo || 0) +
    (adminData?.serviceBreakdown.tuning || 0) +
    (adminData?.serviceBreakdown.retifica || 0) +
    (adminData?.serviceBreakdown.extra || 0);

  const getPercent = (count: number) => {
    if (totalServicesCount === 0) return 0;
    return Math.round((count / totalServicesCount) * 100);
  };

  // Encontra o pico de atendimentos para dimensionar o gráfico
  const maxHourlyCount = Math.max(...(adminData?.hourly.map((h) => h.count) || [1]), 1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      {/* Backdrop Escuro com Blur */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/85 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Janela do Painel */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ type: 'spring', duration: 0.35, bounce: 0.1 }}
        className="relative bg-[#090d16] border border-[#1e293b] w-full max-w-5xl rounded-2xl overflow-hidden shadow-2xl z-10 max-h-[92vh] flex flex-col my-auto"
      >
        {/* Glow Superior */}
        <div className="absolute top-0 right-1/4 w-96 h-32 bg-rose-600/10 rounded-full blur-3xl pointer-events-none -z-10" />

        {/* Top Header */}
        <div className="bg-[#060911] border-b border-[#1e293b] px-6 py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-950/80 border border-rose-800/60 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white uppercase tracking-wider">
                  Painel Administrativo & Telemetria
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 uppercase tracking-widest font-mono">
                  Master
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Auditoria de performance e estatísticas em tempo real (SQLite VPS)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAuthenticated && (
              <>
                <button
                  type="button"
                  onClick={() => fetchAdminData('neco2026')}
                  disabled={isLoading}
                  className="p-2 text-slate-400 hover:text-white rounded-lg bg-[#111827] border border-[#1e293b] hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
                  title="Atualizar Dados"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-400' : ''}`} />
                  <span className="hidden sm:inline">Atualizar</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="p-2 text-slate-400 hover:text-white rounded-lg bg-[#111827] border border-[#1e293b] hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
                  title="Exportar CSV"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">Exportar CSV</span>
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="p-2 text-slate-400 hover:text-rose-300 rounded-lg bg-[#111827] border border-[#1e293b] hover:bg-rose-950/40 transition-colors cursor-pointer text-xs font-semibold"
                  title="Sair"
                >
                  <Lock className="w-3.5 h-3.5" />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Corpo do Painel */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {!isAuthenticated ? (
            /* Tela de Login com Senha Master */
            <div className="max-w-md mx-auto py-12 text-center space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-rose-950/60 border border-rose-800/50 flex items-center justify-center mx-auto shadow-lg shadow-rose-950/50">
                <Lock className="w-8 h-8 text-rose-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Área Restrita</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Insira a senha mestra para visualizar as métricas globais e histórico da oficina.
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-3">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Senha mestra de acesso..."
                  autoFocus
                  className="w-full bg-[#0d1424] border border-[#1e293b] focus:border-rose-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none transition-colors text-center font-mono"
                />
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-bold py-3 px-4 rounded-xl text-sm transition-all shadow-md shadow-rose-900/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Unlock className="w-4 h-4" />
                  {isLoading ? 'Verificando...' : 'Desbloquear Painel'}
                </button>
              </form>
            </div>
          ) : adminData ? (
            /* Dashboard Completo */
            <div className="space-y-6">
              {/* 1. Cards de KPI Principais */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Card 1: Total Hoje */}
                <div className="bg-[#0e1424] border border-[#1e293b] rounded-xl p-4 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                    <span>ATENDIMENTOS HOJE</span>
                    <Clock className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <div className="text-2xl font-black text-white font-mono">
                    {adminData.summary.totalToday}
                  </div>
                  <p className="text-[11px] text-slate-500">Reinicia diariamente às 03:00</p>
                </div>

                {/* Card 2: Total 7 Dias */}
                <div className="bg-[#0e1424] border border-[#1e293b] rounded-xl p-4 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                    <span>ÚLTIMOS 7 DIAS</span>
                    <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
                  </div>
                  <div className="text-2xl font-black text-purple-300 font-mono">
                    {adminData.summary.totalWeek}
                  </div>
                  <p className="text-[11px] text-slate-500">Volume semanal acumulado</p>
                </div>

                {/* Card 3: Taxa de Sucesso */}
                <div className="bg-[#0e1424] border border-[#1e293b] rounded-xl p-4 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                    <span>TAXA DE SUCESSO</span>
                    <Activity className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="text-2xl font-black text-emerald-400 font-mono">
                    {adminData.summary.successRate}%
                  </div>
                  <p className="text-[11px] text-slate-500">Precisão da extração de dados</p>
                </div>

                {/* Card 4: Latência Média */}
                <div className="bg-[#0e1424] border border-[#1e293b] rounded-xl p-4 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                    <span>TEMPO MÉDIO DE IA</span>
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div className="text-2xl font-black text-amber-300 font-mono">
                    {adminData.summary.avgDurationSec}s
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Mais rápido: {adminData.summary.fastestDurationSec}s
                  </p>
                </div>
              </div>

              {/* 2. Seção de Gráficos e Distribuições */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Gráfico de Horários de Pico (7 Colunas) */}
                <div className="lg:col-span-7 bg-[#0e1424] border border-[#1e293b] rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-400" />
                      Horários de Pico (Turno 24h)
                    </h3>
                    <span className="text-xs text-slate-400 font-mono">Serviços / Hora</span>
                  </div>

                  {/* Barras de 00h a 23h */}
                  <div className="h-36 flex items-end gap-1 sm:gap-1.5 pt-4">
                    {adminData.hourly.map((h, i) => {
                      const heightPercent = maxHourlyCount > 0 ? (h.count / maxHourlyCount) * 100 : 0;
                      const isPeak = h.count === maxHourlyCount && h.count > 0;
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                          {/* Tooltip Hover */}
                          <div className="absolute -top-7 bg-slate-900 border border-slate-700 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 whitespace-nowrap font-mono">
                            {h.hour}: {h.count} fichas
                          </div>

                          <div className="w-full bg-[#1e293b] rounded-t-sm h-full flex items-end overflow-hidden">
                            <motion.div
                              initial={{ height: 0 }}
                              animate={{ height: `${Math.max(heightPercent, 4)}%` }}
                              transition={{ duration: 0.5, delay: i * 0.015 }}
                              className={`w-full rounded-t-sm transition-colors ${
                                isPeak
                                  ? 'bg-rose-500 group-hover:bg-rose-400'
                                  : h.count > 0
                                  ? 'bg-blue-500 group-hover:bg-blue-400'
                                  : 'bg-slate-800'
                              }`}
                            />
                          </div>

                          {/* Label da hora a cada 3h ou em telas maiores */}
                          <span className="text-[9px] text-slate-500 font-mono">
                            {i % 4 === 0 ? h.hour.split(':')[0] + 'h' : ''}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Divisão dos Tipos de Serviço & IAs (5 Colunas) */}
                <div className="lg:col-span-5 bg-[#0e1424] border border-[#1e293b] rounded-xl p-5 space-y-4">
                  <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-emerald-400" />
                    Divisão de Serviços
                  </h3>

                  <div className="space-y-3">
                    {/* Troca de Óleo */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 text-amber-300 font-medium">
                          <Droplets className="w-3.5 h-3.5" /> Troca de Óleo
                        </span>
                        <span className="text-slate-300 font-mono">
                          {adminData.serviceBreakdown.oleo} ({getPercent(adminData.serviceBreakdown.oleo)}%)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full transition-all duration-500"
                          style={{ width: `${getPercent(adminData.serviceBreakdown.oleo)}%` }}
                        />
                      </div>
                    </div>

                    {/* Performance & Peças */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 text-blue-300 font-medium">
                          <Zap className="w-3.5 h-3.5" /> Performance & Peças
                        </span>
                        <span className="text-slate-300 font-mono">
                          {adminData.serviceBreakdown.tuning} ({getPercent(adminData.serviceBreakdown.tuning)}%)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all duration-500"
                          style={{ width: `${getPercent(adminData.serviceBreakdown.tuning)}%` }}
                        />
                      </div>
                    </div>

                    {/* Retífica de Motor */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 text-rose-300 font-medium">
                          <Wrench className="w-3.5 h-3.5" /> Retífica de Motor
                        </span>
                        <span className="text-slate-300 font-mono">
                          {adminData.serviceBreakdown.retifica} ({getPercent(adminData.serviceBreakdown.retifica)}%)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-rose-500 rounded-full transition-all duration-500"
                          style={{ width: `${getPercent(adminData.serviceBreakdown.retifica)}%` }}
                        />
                      </div>
                    </div>

                    {/* Remoção de Peça (Extra) */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 text-purple-300 font-medium">
                          <PackageMinus className="w-3.5 h-3.5" /> Remoção de Peça
                        </span>
                        <span className="text-slate-300 font-mono">
                          {adminData.serviceBreakdown.extra} ({getPercent(adminData.serviceBreakdown.extra)}%)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-500 rounded-full transition-all duration-500"
                          style={{ width: `${getPercent(adminData.serviceBreakdown.extra)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Tabela de Auditoria em Tempo Real (Últimos 50 Atendimentos) */}
              <div className="bg-[#0e1424] border border-[#1e293b] rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                      Auditoria de Atendimentos em Tempo Real
                    </h3>
                    <p className="text-xs text-slate-400">
                      Últimos 50 registros sincronizados com a VPS
                    </p>
                  </div>

                  {/* Barra de Busca */}
                  <div className="relative w-full sm:w-64">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Filtrar placa, veículo ou serviço..."
                      className="w-full bg-[#080d1a] border border-[#1e293b] rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                </div>

                {/* Tabela Responsiva */}
                <div className="overflow-x-auto rounded-lg border border-[#1e293b]">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-[#080d1a] text-slate-400 uppercase font-mono text-[11px] border-b border-[#1e293b]">
                      <tr>
                        <th className="py-2.5 px-3">Horário</th>
                        <th className="py-2.5 px-3">Placa</th>
                        <th className="py-2.5 px-3">Veículo</th>
                        <th className="py-2.5 px-3">Serviço Realizado</th>
                        <th className="py-2.5 px-3">Provedor IA</th>
                        <th className="py-2.5 px-3 text-right">Latência</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1e293b] font-mono">
                      {filteredLogs.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-6 text-center text-slate-500">
                            Nenhum registro encontrado.
                          </td>
                        </tr>
                      ) : (
                        filteredLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-[#131b2e] transition-colors">
                            <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                              {log.dateTimeStr}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-amber-300 whitespace-nowrap">
                              {log.placa}
                            </td>
                            <td className="py-2.5 px-3 text-white whitespace-nowrap font-sans font-medium">
                              {log.modelo}
                            </td>
                            <td className="py-2.5 px-3 text-slate-300 max-w-xs truncate font-sans">
                              {log.servico}
                            </td>
                            <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap text-[11px]">
                              {log.model.includes('cloudflare') ? (
                                <span className="text-purple-300">Cloudflare Llama</span>
                              ) : (
                                <span className="text-blue-300">Gemini 3.5 Lite</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right text-slate-400 whitespace-nowrap">
                              {log.durationSec}s
                            </td>
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              {log.success ? (
                                <span className="inline-flex items-center gap-1 text-emerald-400 text-[11px]">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> OK
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-rose-400 text-[11px]">
                                  <AlertTriangle className="w-3.5 h-3.5" /> Falha
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
          ) : (
            <div className="py-12 text-center text-slate-400">Carregando dados da VPS...</div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
