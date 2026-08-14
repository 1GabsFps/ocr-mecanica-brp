# Regras e Fluxo de Trabalho do Projeto

1. **Dev Server:** NÃO rodar `npm run dev` para iniciar o projeto em background.
2. **Backups:** Sempre criar backup do código-fonte antes de modificações significativas.
3. **Deploy Automático na VPS:** Após compilar a versão de produção com `npm run build`, SEMPRE executar o comando SCP para enviar os arquivos diretamente para a VPS:
   ```powershell
   scp -i "C:\Users\gabri\.ssh\amd\ssh-key-2026-07-16.key" -r "d:\projetos\ocr mec\frontend\dist\*" ubuntu@137.131.216.220:/home/ubuntu/MECBRP/
   ```
