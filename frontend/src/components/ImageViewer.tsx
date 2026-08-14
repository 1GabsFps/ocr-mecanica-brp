import React, { useState, useRef } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Image as ImageIcon,
  Upload,
} from 'lucide-react';
import { ZoomState } from '../types';

interface ImageViewerProps {
  imageSrc: string;
  onFileInputChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({
  imageSrc,
  onFileInputChange,
}) => {
  const [zoom, setZoom] = useState<ZoomState>({ scale: 1, positionX: 0, positionY: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Controles de Zoom
  const handleZoomIn = () => {
    setZoom((prev) => ({ ...prev, scale: Math.min(prev.scale + 0.25, 4) }));
  };

  const handleZoomOut = () => {
    setZoom((prev) => ({ ...prev, scale: Math.max(prev.scale - 0.25, 0.5) }));
  };

  const handleResetZoom = () => {
    setZoom({ scale: 1, positionX: 0, positionY: 0 });
  };

  // Arrastar imagem (Pan)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom.scale <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - zoom.positionX, y: e.clientY - zoom.positionY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setZoom((prev) => ({
      ...prev,
      positionX: e.clientX - dragStart.x,
      positionY: e.clientY - dragStart.y,
    }));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div className="bg-[#111827] border border-[#1f2937] rounded-xl overflow-hidden flex flex-col h-full shadow-sm">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={onFileInputChange}
        className="hidden"
      />

      {/* Barra de Ferramentas da Imagem */}
      <div className="bg-[#0f172a] border-b border-[#1f2937] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-slate-300 font-semibold">
          <ImageIcon className="w-4 h-4 text-blue-400" />
          <span>Imagem</span>
          <span className="hidden sm:inline-block text-[10px] text-slate-400 bg-[#1e293b] px-2 py-0.5 rounded font-mono">
            Ctrl+V para trocar
          </span>
        </div>

        {/* Controles */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Zoom */}
          <div className="flex items-center bg-[#1e293b] rounded-lg border border-[#334155] p-0.5">
            <button
              onClick={handleZoomOut}
              className="p-1 text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors active:scale-95 cursor-pointer"
              title="Reduzir Zoom (-)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-mono px-2 text-blue-400 font-semibold">
              {Math.round(zoom.scale * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              className="p-1 text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors active:scale-95 cursor-pointer"
              title="Aumentar Zoom (+)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleResetZoom}
              className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors active:scale-95 cursor-pointer ml-0.5"
              title="Ajustar ao tamanho original"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>

          {/* Botão de Trocar Imagem */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-[#1e293b] hover:bg-[#334155] text-slate-200 border border-[#334155] transition-all active:scale-95 cursor-pointer"
            title="Escolher outra imagem do computador"
          >
            <Upload className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">Trocar Imagem</span>
          </button>
        </div>
      </div>

      {/* Área de Visualização com Zoom/Pan */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`relative flex-1 min-h-[380px] bg-[#070b14] flex items-center justify-center overflow-hidden select-none p-4 ${
          zoom.scale > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
        }`}
      >
        <div
          style={{
            transform: `translate(${zoom.positionX}px, ${zoom.positionY}px) scale(${zoom.scale})`,
            transition: isDragging ? 'none' : 'transform 0.15s ease-out',
            transformOrigin: 'center center',
          }}
          className="relative max-w-full max-h-full flex items-center justify-center"
        >
          <img
            src={imageSrc}
            alt="Print do Veículo"
            className="max-h-[500px] w-auto object-contain rounded border border-[#1f2937] shadow-xl pointer-events-none"
          />
        </div>
      </div>
    </div>
  );
};
