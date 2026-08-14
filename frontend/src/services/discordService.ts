import { compressImageForAi } from '../utils/imagePreprocessing';

/**
 * Serviço de Integração com Discord Webhook para armazenamento de imagens em alta resolução,
 * sincronização dinâmica com edição de mensagens (PATCH), auditoria técnica detalhada e Alertas de B.O.
 */

export const DISCORD_WEBHOOK_URL =
  (import.meta.env.VITE_DISCORD_WEBHOOK_URL as string) ||
  'https://canary.discord.com/api/webhooks/1537479214041800766/70lWLdEwqV736ZhRG2ugpTuMHIj8QkFW7mrUkbJGdKAid_NoVddzqfu_UeAV6sZwwfRz';

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

/**
 * Converte um DataURL (Base64) em Blob binário para envio multipart/form-data de forma nativa e assíncrona.
 */
export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

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
}

export function formatDiscordContent(metadata?: DiscordPayloadMetadata): string {
  const modelLabel = metadata?.aiModel ? `\`${metadata.aiModel}\`` : '`gemini-3.5-flash-lite`';
  const durationLabel = metadata?.durationMs
    ? `\`${(metadata.durationMs / 1000).toFixed(2)}s\` (${metadata.durationMs}ms)`
    : '`~1.4s`';
  const keyLabel = metadata?.keySlot ? `\`${metadata.keySlot}\`` : '`Chave #1 (Principal)`';

  let hedgeLine = '';
  if (metadata?.hedged) {
    hedgeLine = '\n⚡ **Hedge:** `Acionado (Chave Reserva / Salva-Vidas)`';
  }

  let statusLine = '';
  if (metadata?.missingFields && metadata.missingFields.length > 0) {
    statusLine = `\n⚠️ **Status:** \`Incompleto (Faltando: ${metadata.missingFields.join(', ')})\``;
  }

  return `🚗 **Registro de Ficha - Mecânica BRP**\n**Veículo:** \`${metadata?.modelo || 'Não informado'}\`\n**Placa:** \`${metadata?.placa || 'Não informado'}\`\n**Proprietário:** \`${metadata?.proprietario || 'Não informado'}\`\n**Serviço:** \`${metadata?.servico || 'Não informado'}\`\n**IA Utilizada:** ${modelLabel}\n**Slot da Chave:** ${keyLabel}${hedgeLine}${statusLine}\n**Tempo de Resposta:** ${durationLabel}`;
}

/**
 * Envia um Alerta Crítico no Discord marcando o administrador (<@ID>) caso ocorra um erro severo / B.O.
 */
export async function sendDiscordSystemAlert(alert: {
  errorType: string;
  message: string;
  keySlot?: string;
  code?: number;
}): Promise<boolean> {
  if (!DISCORD_WEBHOOK_URL) {
    return false;
  }

  const now = Date.now();
  const lastTime = lastAlertTimeMap.get(alert.errorType) || 0;

  // Anti-flood: evita spammar a menção do usuário em caso de muitos erros seguidos
  if (now - lastTime < ALERT_COOLDOWN_MS) {
    return false;
  }
  setBoundedMap(lastAlertTimeMap, alert.errorType, now);

  const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const content = `🚨 <@${ADMIN_DISCORD_USER_ID}> **ALERTA DE SISTEMA - MECÂNICA BRP**\n⚠️ **Tipo de Falha:** \`${alert.errorType}\`\n🔑 **Chave / Origem:** \`${alert.keySlot || 'Pool do Servidor'}\`\n📝 **Detalhes do Erro:** \`${alert.message}\`\n🕒 **Horário:** \`${timestamp}\``;

  try {
    const response = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content }),
    });

    return response.ok;
  } catch (err) {
    console.warn('Falha ao enviar alerta de B.O. para o Discord:', err);
    return false;
  }
}

/**
 * Envia a imagem em alta resolução otimizada (WebP 1080p/2K ~200KB) para o Discord Webhook com retry em 429.
 */
export async function uploadImageToDiscord(
  imageSrc: string,
  metadata?: DiscordPayloadMetadata
): Promise<DiscordUploadResult | null> {
  if (!DISCORD_WEBHOOK_URL) {
    return null;
  }

  try {
    const compressed = await compressImageForAi(imageSrc, 1920, 0.90, 'webp');
    const blob = await dataUrlToBlob(compressed.dataUrl);
    const extension = compressed.mimeType === 'image/webp' ? 'webp' : 'jpg';
    const filename = `veiculo_${metadata?.placa || 'print'}_${Date.now()}.${extension}`;

    const createFormData = () => {
      const formData = new FormData();
      formData.append('file', blob, filename);
      const content = formatDiscordContent(metadata);
      formData.append('payload_json', JSON.stringify({ content }));
      return { formData, content };
    };

    let { formData, content } = createFormData();

    let response = await fetch(`${DISCORD_WEBHOOK_URL}?wait=true`, {
      method: 'POST',
      body: formData,
    });

    // Tratamento de Rate Limit HTTP 429 com Retry-After backoff
    if (response.status === 429) {
      const errData = await response.json().catch(() => ({}));
      const retryAfterSec = parseFloat(response.headers.get('Retry-After') || '') || (errData?.retry_after ? Number(errData.retry_after) : 1);
      const backoffMs = Math.min(Math.max(Math.round(retryAfterSec * 1000), 500), 5000);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));

      const retryData = createFormData();
      formData = retryData.formData;
      content = retryData.content;
      response = await fetch(`${DISCORD_WEBHOOK_URL}?wait=true`, {
        method: 'POST',
        body: formData,
      });
    }

    if (!response.ok) {
      console.warn('Erro na resposta do Discord Webhook:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();
    const attachment = data.attachments?.[0];

    if (attachment && attachment.url) {
      const messageId = data.id;
      if (messageId) {
        setBoundedMap(lastDiscordContentMap, messageId, content);
        setBoundedMap(lastDiscordPatchTimeMap, messageId, Date.now());
      }

      return {
        url: attachment.url,
        proxyUrl: attachment.proxy_url,
        filename: attachment.filename,
        messageId,
      };
    }

    return null;
  } catch (err) {
    console.warn('Falha ao enviar imagem para o Discord Webhook:', err);
    return null;
  }
}

/**
 * Edita a mensagem no Discord com Blindagem de 2 Camadas (Anti-Spam + Trailing Throttle de 5s) e backoff 429.
 */
export async function updateDiscordMessage(
  messageId: string,
  metadata: DiscordPayloadMetadata
): Promise<boolean> {
  if (!messageId || !DISCORD_WEBHOOK_URL) return false;

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
    let response = await fetch(`${DISCORD_WEBHOOK_URL}/messages/${messageId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: newContent }),
    });

    if (response.status === 429) {
      const errData = await response.json().catch(() => ({}));
      const retryAfterSec = parseFloat(response.headers.get('Retry-After') || '') || (errData?.retry_after ? Number(errData.retry_after) : 1);
      const backoffMs = Math.min(Math.max(Math.round(retryAfterSec * 1000), 500), 5000);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));

      response = await fetch(`${DISCORD_WEBHOOK_URL}/messages/${messageId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: newContent }),
      });
    }

    return response.ok;
  } catch (err) {
    console.warn('Falha ao editar mensagem no Discord:', err);
    return false;
  }
}
