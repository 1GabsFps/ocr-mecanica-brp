import React, { useState, useRef } from 'react';
import {
  Check,
  Copy,
  Trash2,
  Tag,
  User,
  Car,
  Wrench,
  FileText,
  FileCode,
  AlertCircle,
  ShieldAlert,
  Lock,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { VehicleData } from '../types';
import { playCopySound, playTrashSound } from '../utils/soundEffects';
import { validateVehicleData } from '../utils/validation';

interface ResultPanelProps {
  data: VehicleData;
  onDataChange: (newData: VehicleData) => void;
  onReset: () => void;
  rawOcrText?: string;
  onOpenRawDrawer?: () => void;
  onCopyComplete?: () => void;
}

export const ResultPanel: React.FC<ResultPanelProps> = ({
  data,
  onDataChange,
  onReset,
  onOpenRawDrawer,
  onCopyComplete,
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const placaInputRef = useRef<HTMLInputElement>(null);
  const propInputRef = useRef<HTMLInputElement>(null);
  const modeloInputRef = useRef<HTMLInputElement>(null);
  const servicoInputRef = useRef<HTMLInputElement>(null);

  // Validação dos campos
  const validation = validateVehicleData(data);

  // Gera o texto padronizado final
  const generateFormattedText = () => {
    const placa = data.placa || '[Não identificado]';
    const proprietario = data.proprietario || '[Não identificado]';
    const modelo = data.modelo || '[Não identificado]';
    const servico = data.servico || 'Troca de óleo e filtro';

    return `Placa do veículo: ${placa}\nNome do proprietário: ${proprietario}\nModelo do veículo: ${modelo}\nServiço: ${servico}`;
  };

  const formattedText = generateFormattedText();

  const handlePlacaChange = (val: string) => {
    onDataChange({ ...data, placa: val });
  };

  const handleProprietarioChange = (val: string) => {
    onDataChange({ ...data, proprietario: val });
  };

  const handleModeloChange = (val: string) => {
    onDataChange({ ...data, modelo: val });
  };

  const handleServicoChange = (val: string) => {
    onDataChange({ ...data, servico: val });
  };

  // Copiar Texto Formatado com Validação Estrita
  const handleCopyText = async () => {
    if (!validation.isValid) {
      toast.error('Preencha os campos obrigatórios para copiar!', {
        description: `Campos pendentes: ${validation.missingFields.join(', ')}`,
        duration: 3500,
      });

      // Foca no primeiro campo não preenchido
      if (!validation.isPlacaValid) {
        placaInputRef.current?.focus();
      } else if (!validation.isProprietarioValid) {
        propInputRef.current?.focus();
      } else if (!validation.isModeloValid) {
        modeloInputRef.current?.focus();
      } else if (!validation.isServicoValid) {
        servicoInputRef.current?.focus();
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(formattedText);
      playCopySound();
      setCopied(true);
      onCopyComplete?.();
      toast.success('Texto copiado com sucesso!', {
        description: `${data.modelo} • ${data.placa}`,
        duration: 2000,
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Erro ao copiar:', err);
      toast.error('Erro ao acessar a área de transferência');
    }
  };

  const handleResetWithSound = () => {
    playTrashSound();
    onReset();
    toast('Campos limpos');
  };

  // Bloqueio de cópia manual direta na caixa de pré-visualização
  const handleManualCopyBlock = (e: React.UIEvent) => {
    e.preventDefault();
    toast.warning('Cópia direta bloqueada!', {
      description: 'Utilize o botão "Copiar Texto" abaixo para gerar a ficha validada.',
      duration: 3000,
    });
  };

  return (
    <div className="bg-[#0f1523] border border-[#1e293b] rounded-2xl p-5 flex flex-col justify-between space-y-4 h-full shadow-lg">
      <div className="space-y-3.5">
        {/* Cabeçalho do Painel */}
        <div className="flex items-center justify-between pb-3 border-b border-[#1e293b]">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-400" />
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">
              Dados Extraídos
            </h2>
          </div>

          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleResetWithSound}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-rose-300 hover:bg-rose-950/30 px-2 py-1 rounded-lg border border-transparent hover:border-rose-900/40 transition-colors cursor-pointer"
            title="Limpar formulário"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Limpar</span>
          </motion.button>
        </div>

        {/* 1. Campo: Placa */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
              <Tag className="w-3.5 h-3.5 text-blue-400" />
              <span>Placa do Veículo</span>
            </label>
            {!validation.isPlacaValid && (
              <span className="text-[10px] text-rose-400 font-semibold flex items-center gap-1 font-mono">
                <AlertCircle className="w-3 h-3" />
                Obrigatório
              </span>
            )}
          </div>
          <input
            ref={placaInputRef}
            type="text"
            value={data.placa}
            onChange={(e) => handlePlacaChange(e.target.value)}
            placeholder="Ex: ABC 1D23 ou ABC 1234"
            className={`w-full rounded-xl px-3.5 py-2 text-sm font-mono tracking-wider outline-none transition-all ${
              !validation.isPlacaValid
                ? 'bg-rose-950/25 border border-rose-500/80 text-rose-200 placeholder:text-rose-400/40 focus:border-rose-400 focus:ring-1 focus:ring-rose-400/50'
                : 'bg-[#090d16] border border-[#1e293b] focus:border-blue-500 text-white'
            }`}
          />
        </div>

        {/* 2. Campo: Proprietário (Exemplo: Vincent Montgomery) */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
              <User className="w-3.5 h-3.5 text-blue-400" />
              <span>Nome do Proprietário</span>
            </label>
            {!validation.isProprietarioValid && (
              <span className="text-[10px] text-rose-400 font-semibold flex items-center gap-1 font-mono">
                <AlertCircle className="w-3 h-3" />
                Obrigatório
              </span>
            )}
          </div>
          <input
            ref={propInputRef}
            type="text"
            value={data.proprietario}
            onChange={(e) => handleProprietarioChange(e.target.value)}
            placeholder="Ex: Vincent Montgomery"
            className={`w-full rounded-xl px-3.5 py-2 text-sm outline-none transition-all ${
              !validation.isProprietarioValid
                ? 'bg-rose-950/25 border border-rose-500/80 text-rose-200 placeholder:text-rose-400/40 focus:border-rose-400 focus:ring-1 focus:ring-rose-400/50'
                : 'bg-[#090d16] border border-[#1e293b] focus:border-blue-500 text-white'
            }`}
          />
        </div>

        {/* 3. Campo: Modelo do Veículo */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
              <Car className="w-3.5 h-3.5 text-amber-400" />
              <span>Modelo do Veículo</span>
            </label>
            {!validation.isModeloValid && (
              <span className="text-[10px] text-rose-400 font-semibold flex items-center gap-1 font-mono">
                <AlertCircle className="w-3 h-3" />
                Obrigatório
              </span>
            )}
          </div>
          <input
            ref={modeloInputRef}
            type="text"
            value={data.modelo}
            onChange={(e) => handleModeloChange(e.target.value)}
            placeholder="Ex: FH16 780, FENEMÊ, GOLF GTI MK4"
            className={`w-full rounded-xl px-3.5 py-2 text-sm font-mono uppercase font-bold outline-none transition-all ${
              !validation.isModeloValid
                ? 'bg-rose-950/25 border border-rose-500/80 text-rose-200 placeholder:text-rose-400/40 focus:border-rose-400 focus:ring-1 focus:ring-rose-400/50'
                : 'bg-[#090d16] border border-[#1e293b] focus:border-blue-500 text-amber-300'
            }`}
          />
        </div>

        {/* 4. Campo: Serviço */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
              <Wrench className="w-3.5 h-3.5 text-slate-400" />
              <span>Serviço Realizado</span>
            </label>
            {!validation.isServicoValid && (
              <span className="text-[10px] text-rose-400 font-semibold flex items-center gap-1 font-mono">
                <AlertCircle className="w-3 h-3" />
                Obrigatório
              </span>
            )}
          </div>
          <input
            ref={servicoInputRef}
            type="text"
            value={data.servico}
            onChange={(e) => handleServicoChange(e.target.value)}
            placeholder="Ex: Troca de óleo e filtro, Freio Rua Super"
            className={`w-full rounded-xl px-3.5 py-2 text-sm outline-none transition-all ${
              !validation.isServicoValid
                ? 'bg-rose-950/25 border border-rose-500/80 text-rose-200 placeholder:text-rose-400/40 focus:border-rose-400 focus:ring-1 focus:ring-rose-400/50'
                : 'bg-[#090d16] border border-[#1e293b] focus:border-blue-500 text-white'
            }`}
          />
        </div>

        {/* 5. Caixa de Pré-visualização do Formato (CÓPIA MANUAL BLOQUEADA) */}
        <div className="pt-0.5">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-semibold text-slate-400">
                Formato de Cópia:
              </label>
              <span className="text-[10px] text-slate-500 font-mono flex items-center gap-0.5">
                <Lock className="w-2.5 h-2.5" />
                Protegido
              </span>
            </div>
            {onOpenRawDrawer && (
              <button
                type="button"
                onClick={onOpenRawDrawer}
                className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer transition-colors"
                title="Visualizar texto bruto lido pelo OCR"
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>Ver Bruto</span>
              </button>
            )}
          </div>

          <div
            onCopy={handleManualCopyBlock}
            onCut={handleManualCopyBlock}
            onContextMenu={handleManualCopyBlock}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
                handleManualCopyBlock(e);
              }
            }}
            className={`w-full bg-[#070b14] border rounded-xl p-3 text-xs font-mono select-none cursor-not-allowed leading-relaxed transition-all relative ${
              !validation.isValid
                ? 'border-rose-900/50 text-rose-300/80'
                : 'border-[#1e293b] text-slate-300'
            }`}
            style={{
              userSelect: 'none',
              WebkitUserSelect: 'none',
              MozUserSelect: 'none',
              msUserSelect: 'none',
            }}
          >
            <pre className="font-mono whitespace-pre-wrap select-none pointer-events-none">
              {formattedText}
            </pre>
          </div>
        </div>
      </div>

      {/* Botão de Cópia com Trava de Validação */}
      <div className="pt-1">
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.97 }}
          type="button"
          onClick={handleCopyText}
          className={`w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer uppercase tracking-wider shadow-md ${
            !validation.isValid
              ? 'bg-rose-950/40 border border-rose-600/60 text-rose-300 hover:bg-rose-900/50 hover:border-rose-500'
              : copied
              ? 'bg-emerald-600 text-white'
              : 'bg-blue-600 hover:bg-blue-500 text-white'
          }`}
        >
          {!validation.isValid ? (
            <>
              <ShieldAlert className="w-4 h-4 text-rose-400 animate-pulse" />
              <span>Preencha os campos obrigatórios para copiar</span>
            </>
          ) : copied ? (
            <>
              <Check className="w-4 h-4 text-white" />
              <span>Texto Copiado!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              <span>Copiar Texto</span>
            </>
          )}
        </motion.button>
      </div>
    </div>
  );
};
