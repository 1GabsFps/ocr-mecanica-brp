# 🚗 Leitor OCR de Fichas - Mecânica BRP

Sistema moderno de extração e reconhecimento inteligente de fichas de mecânica GTA RP / FiveM utilizando Inteligência Artificial (Google Gemini 3.5 Flash Lite) com fallback local.

---

## ✨ Funcionalidades Principais

- ⚡ **Extração Ultrarrápida (~1.5s):** Leitura de tabelas HUD com precisão cirúrgica de placa, proprietário, modelo do veículo e serviço.
- 📸 **Auto-Colar no Alt+Tab:** Ao capturar um print no jogo e alternar para a aba do leitor, a imagem é identificada e processada automaticamente.
- 📋 **Auto-Copiar Ficha:** Formatação instantânea pronta para colar no Discord ou sistema da oficina.
- 🏎️ **Corrida de Chaves (Hedged Racing):** Sistema redundante com failover automático em 1.5s para garantir alta velocidade contínua.
- 🛡️ **Blindagem Anti-Rate Limit:** Sincronização e edição dinâmica de mensagens no Discord via Webhook sem risco de bloqueio.
- 📊 **Telemetria em Tempo Real:** Micro-serviço Docker com persistência SQLite exibindo total de fichas do dia, precisão e tempo médio.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, Framer Motion, Lucide Icons, Sonner.
- **Backend / Telemetria:** Python 3.12 (Alpine), Docker, SQLite, Nginx (VPS Ubuntu).
- **IA Multimodal:** Google Gemini 3.5 Flash Lite com *Constrained JSON Decoding*.

---

## 🚀 Como Rodar Localmente

```bash
# Entrar na pasta do frontend
cd frontend

# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento
npm run dev
```
