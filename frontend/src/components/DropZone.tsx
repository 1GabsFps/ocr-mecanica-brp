import React from 'react';
import { Clipboard, Upload, ShieldAlert } from 'lucide-react';

interface DropZoneProps {
  onFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  isDragging: boolean;
  error?: string | null;
}

export const DropZone: React.FC<DropZoneProps> = ({
  onFileInputChange,
  onDragOver,
  onDragLeave,
  onDrop,
  isDragging,
  error,
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className="w-full max-w-3xl mx-auto my-8">
      {/* Área Principal de Drag & Drop / Ctrl+V */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-10 sm:p-14 text-center cursor-pointer transition-colors duration-150 group ${
          isDragging
            ? 'border-blue-500 bg-blue-950/20'
            : 'border-[#1f2937] hover:border-blue-500/60 bg-[#111827] hover:bg-[#141d2f]'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={onFileInputChange}
          className="hidden"
        />

        <div className="max-w-md mx-auto flex flex-col items-center">
          {/* Ícone */}
          <div className="w-14 h-14 rounded-xl bg-[#1f2937] border border-[#374151] flex items-center justify-center mb-5 group-hover:border-blue-500/50 transition-colors">
            <Clipboard className="w-7 h-7 text-blue-400" />
          </div>

          {/* Badges de Atalhos */}
          <div className="flex items-center gap-2 mb-3">
            <span className="px-2.5 py-1 rounded-md bg-[#1f2937] text-blue-300 font-mono font-medium text-xs border border-[#374151]">
              Ctrl + V
            </span>
            <span className="text-slate-500 text-xs">ou</span>
            <span className="px-2.5 py-1 rounded-md bg-[#1f2937] text-slate-300 font-mono font-medium text-xs border border-[#374151]">
              Win + Shift + S
            </span>
          </div>

          <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight mb-2">
            Cole uma foto ou arraste o print aqui
          </h2>

          <p className="text-xs sm:text-sm text-slate-400 mb-6 leading-relaxed max-w-sm">
            Tire o print da HUD da oficina e cole diretamente para extrair placa, proprietário e veículo.
          </p>

          <button
            type="button"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs tracking-wider uppercase transition-colors cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Selecionar Imagem</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-3 rounded-lg bg-rose-950/30 border border-rose-800/40 text-rose-300 text-xs flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
