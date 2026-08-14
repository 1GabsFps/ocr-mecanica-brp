/**
 * Sistema de Efeitos Sonoros Táteis gerados via Web Audio API.
 * Sem arquivos pesados, sem delay de carregamento e com áudio cristalino.
 */

let sharedAudioContext: AudioContext | null = null;

export function getSharedAudioContext(): AudioContext | null {
  try {
    if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return null;
      sharedAudioContext = new AudioContextClass();
    }
    if (sharedAudioContext.state === 'suspended') {
      sharedAudioContext.resume().catch(() => {});
    }
    return sharedAudioContext;
  } catch (_) {
    return null;
  }
}

/**
 * 1. Som de Sucesso / Auto-Cópia: Chime suave de 2 tons (Plim!)
 */
export function playSuccessChime() {
  const ctx = getSharedAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(880, now); // A5
  osc1.frequency.exponentialRampToValueAtTime(1174.66, now + 0.08); // D6

  gain1.gain.setValueAtTime(0.06, now);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  osc1.start(now);
  osc1.stop(now + 0.12);

  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(1318.51, now + 0.06); // E6
  osc2.frequency.exponentialRampToValueAtTime(1760, now + 0.18); // A6

  gain2.gain.setValueAtTime(0.07, now + 0.06);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.start(now + 0.06);
  osc2.stop(now + 0.22);
}

/**
 * 2. Som de Imagem Colada (Ctrl+V / Drag): Pop mecânico rápido
 */
export function playPasteSound() {
  const ctx = getSharedAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(300, now);
  osc.frequency.exponentialRampToValueAtTime(750, now + 0.06);

  gain.gain.setValueAtTime(0.05, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.08);
}

/**
 * 3. Som de Cópia Manual (Botão Copiar): Click digital tátil
 */
export function playCopySound() {
  const ctx = getSharedAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1200, now);
  osc.frequency.exponentialRampToValueAtTime(1600, now + 0.04);

  gain.gain.setValueAtTime(0.06, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.06);
}

/**
 * 4. Som de Refinamento da IA (quando a IA confirma os dados com precisão total): Acorde harmônico suave
 */
export function playAiRefinedSound() {
  const ctx = getSharedAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  const notes = [659.25, 830.61, 987.77, 1318.51]; // E5, G#5, B5, E6
  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const startTime = now + idx * 0.035;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.04, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.14);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + 0.14);
  });
}

/**
 * 5. Som de Seleção de Chip de Serviço: Tap amigável
 */
export function playChipSelectSound() {
  const ctx = getSharedAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(520, now);
  osc.frequency.exponentialRampToValueAtTime(680, now + 0.04);

  gain.gain.setValueAtTime(0.04, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.05);
}

/**
 * 6. Som do Botão Auto-Copiar (Toggle ON / OFF): Switch digital
 */
export function playToggleSound(isOn: boolean) {
  const ctx = getSharedAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';

  if (isOn) {
    // Tom subindo (ON)
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(950, now + 0.06);
  } else {
    // Tom descendo (OFF)
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(450, now + 0.06);
  }

  gain.gain.setValueAtTime(0.05, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.07);
}

/**
 * 7. Som de Limpar / Excluir: Swoosh suave descendente
 */
export function playTrashSound() {
  const ctx = getSharedAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(500, now);
  osc.frequency.exponentialRampToValueAtTime(180, now + 0.1);

  gain.gain.setValueAtTime(0.05, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.1);
}

