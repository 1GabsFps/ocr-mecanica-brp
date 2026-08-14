import fs from 'fs';

async function listAllV1Beta() {
  const envContent = fs.readFileSync('d:/projetos/ocr mec/frontend/.env.local', 'utf8');
  const match = envContent.match(/VITE_GEMINI_API_KEY=(.+)/);
  const apiKey = match[1].trim();

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  const data = await res.json();
  console.log(data.models?.map(m => m.name));
}

listAllV1Beta();
