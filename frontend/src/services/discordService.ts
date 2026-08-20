import { compressImageForAi } from '../utils/imagePreprocessing';

/**
 * Serviço de Integração com Discord através do Proxy Seguro Server-Side na VPS.
 * A URL e credenciais do Webhook nunca são expostas no código cliente/frontend.
 */

export const ADMIN_DISCORD_USER_ID = '754463654233243748';

// Helper de Map limitado para evitar memory leak (max 100 itens)
function setBoundedMap<K, V>(map: Map<K, V>, key: K, value: V, maxSize = 100): void {
  if (map.size >= maxSize) {
    const oldestKey = map.keys().next().value;
    if (oldestKey !== undefined) {
      map.delete(oldestKey);
    }
  }
  map.set(key, value);
}

// Camada 1: Cache do último conteúdo enviado (Deduplicação / Anti-Spam)
const lastDiscordContentMap = new Map<string, string>();

// Camada 2: Trava de Cooldown por Mensagem (Trailing Throttle de 5 Segundos)
const lastDiscordPatchTimeMap = new Map<string, number>();
const pendingPatchTimerMap = new Map<string, ReturnType<typeof setTimeout>>();

const DISCORD_PATCH_COOLDOWN_MS = 5000; // 5 Segundos estritos

// Cooldown de Alertas de B.O. (impede flood de menções repetidas em caso de instabilidade)
const lastAlertTimeMap = new Map<string, number>();
const ALERT_COOLDOWN_MS = 60000; // 1 minuto de intervalo por tipo de erro

export interface DiscordUploadResult {
  url: string;
  proxyUrl?: string;
  filename?: string;
  messageId?: string;
}

export interface DiscordPayloadMetadata {
  placa?: string;
  modelo?: string;
  proprietario?: string;
  servico?: string;
  aiModel?: string;
  durationMs?: number;
  keySlot?: string;
  hedged?: boolean;
  missingFields?: string[];
  mechanicName?: string;
  mechanicSteamHex?: string;
}

function getModelDisplayLabel(aiModel?: string): string {
  if (!aiModel || aiModel === 'gemini-3.5-flash-lite') return '`Gemini 3.5 Flash Lite` (Google)';
  if (aiModel === 'gemini-3.1-flash-lite') return '`Gemini 3.1 Flash Lite` (Google Fallback)';
  if (aiModel === 'cloudflare-llama-3.2-11b' || aiModel.includes('llama') || aiModel.includes('cloudflare')) {
    return '`Llama 3.2 11B Vision` (Meta / Cloudflare Workers AI)';
  }
  return `\`${aiModel}\``;
}

export function formatDiscordContent(metadata?: DiscordPayloadMetadata): string {
  const modelLabel = getModelDisplayLabel(metadata?.aiModel);
  const durationLabel = metadata?.durationMs
    ? `\`${(metadata.durationMs / 1000).toFixed(2)}s\` (${metadata.durationMs}ms)`
    : '`~1.4s`';
  const keyLabel = metadata?.keySlot ? `\`${metadata.keySlot}\`` : '`Chave #1 (Principal)`';

  let hedgeLine = '';
  if (metadata?.hedged) {
    hedgeLine = '\n⚡ **Hedge:** `Acionado (Chave Reserva / Salva-Vidas)`';
  }

  let mechanicLine = '';
  if (metadata?.mechanicName) {
    mechanicLine = `\n🔧 **Mecânico:** \`${metadata.mechanicName}\``;
  }

  let statusLine = '';
  if (metadata?.missingFields && metadata.missingFields.length > 0) {
    statusLine = `\n⚠️ **Status:** \`Incompleto (Faltando: ${metadata.missingFields.join(', ')})\``;
  }

  return `🚗 **Registro de Ficha - Mecânica BRP**\n**Veículo:** \`${metadata?.modelo || 'Não informado'}\`\n**Placa:** \`${metadata?.placa || 'Não informado'}\`\n**Proprietário:** \`${metadata?.proprietario || 'Não informado'}\`\n**Serviço:** \`${metadata?.servico || 'Não informado'}\`${mechanicLine}\n**IA Utilizada:** ${modelLabel}\n**Slot / Origem:** ${keyLabel}${hedgeLine}${statusLine}\n**Tempo de Resposta:** ${durationLabel}`;
}

/**
 * Envia um Alerta ou Log Técnico no Discord via Proxy Seguro na VPS.
 */
export async function sendDiscordSystemAlert(alert: {
  errorType: string;
  message: string;
  keySlot?: string;
  code?: number;
  mentionAdmin?: boolean;
}): Promise<boolean> {
  const now = Date.now();
  const lastTime = lastAlertTimeMap.get(alert.errorType) || 0;

  // Anti-flood: evita spammar em caso de muitos erros seguidos (1 min por tipo de erro)
  if (now - lastTime < ALERT_COOLDOWN_MS) {
    return false;
  }
  setBoundedMap(lastAlertTimeMap, alert.errorType, now);

  const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const shouldMention = alert.mentionAdmin ?? true;
  const header = shouldMention
    ? `🚨 <@${ADMIN_DISCORD_USER_ID}> **ALERTA CRÍTICO DE SISTEMA**`
    : `ℹ️ **LOG DE CONTINGÊNCIA / INFRAESTRUTURA**`;

  const content = `${header} - **MECÂNICA BRP**\n⚠️ **Tipo de Evento:** \`${alert.errorType}\`\n🔑 **Origem / Slot:** \`${alert.keySlot || 'Pool de IAs'}\`\n📝 **Detalhes Técnicos:** \`${alert.message}\`\n🕒 **Horário:** \`${timestamp}\``;

  try {
    const response = await fetch('/api/telemetry/discord/alert', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content }),
    });

    return response.ok;
  } catch (err) {
    console.warn('Falha ao enviar alerta para o proxy do Discord:', err);
    return false;
  }
}

/**
 * Envia a imagem otimizada (WebP 1080p/2K ~200KB) para o Discord via Proxy Seguro na VPS.
 */
export async function uploadImageToDiscord(
  imageSrc: string,
  metadata?: DiscordPayloadMetadata
): Promise<DiscordUploadResult | null> {
  try {
    const compressed = await compressImageForAi(imageSrc, 1600, 0.85, 'webp');
    const extension = compressed.mimeType === 'image/webp' ? 'webp' : 'jpg';
    const filename = `veiculo_${metadata?.placa || 'print'}_${Date.now()}.${extension}`;
    const content = formatDiscordContent(metadata);

    const response = await fetch('/api/telemetry/discord/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content,
        image: compressed.dataUrl,
        filename,
      }),
    });

    if (!response.ok) {
      console.warn('Erro na resposta do proxy do Discord:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();
    if (data.url) {
      const messageId = data.messageId;
      if (messageId) {
        setBoundedMap(lastDiscordContentMap, messageId, content);
        setBoundedMap(lastDiscordPatchTimeMap, messageId, Date.now());
      }

      return {
        url: data.url,
        proxyUrl: data.proxyUrl,
        filename: data.filename || filename,
        messageId,
      };
    }

    return null;
  } catch (err) {
    console.warn('Falha ao enviar imagem para o proxy do Discord:', err);
    return null;
  }
}

/**
 * Edita a mensagem no Discord via Proxy Seguro na VPS com Cooldown de 5s.
 */
export async function updateDiscordMessage(
  messageId: string,
  metadata: DiscordPayloadMetadata
): Promise<boolean> {
  if (!messageId) return false;

  const newContent = formatDiscordContent(metadata);

  if (lastDiscordContentMap.get(messageId) === newContent) {
    return true;
  }

  const now = Date.now();
  const lastPatchTime = lastDiscordPatchTimeMap.get(messageId) || 0;
  const elapsedSinceLastPatch = now - lastPatchTime;

  if (elapsedSinceLastPatch < DISCORD_PATCH_COOLDOWN_MS) {
    const existingTimer = pendingPatchTimerMap.get(messageId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const remainingCooldown = DISCORD_PATCH_COOLDOWN_MS - elapsedSinceLastPatch;
    const timer = setTimeout(() => {
      pendingPatchTimerMap.delete(messageId);
      updateDiscordMessage(messageId, metadata);
    }, remainingCooldown);

    setBoundedMap(pendingPatchTimerMap, messageId, timer);
    return true;
  }

  const existingTimer = pendingPatchTimerMap.get(messageId);
  if (existingTimer) {
    clearTimeout(existingTimer);
    pendingPatchTimerMap.delete(messageId);
  }

  setBoundedMap(lastDiscordPatchTimeMap, messageId, now);
  setBoundedMap(lastDiscordContentMap, messageId, newContent);

  try {
    const response = await fetch('/api/telemetry/discord/update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messageId,
        content: newContent,
      }),
    });

    return response.ok;
  } catch (err) {
    console.warn('Falha ao editar mensagem no proxy do Discord:', err);
    return false;
  }
}
