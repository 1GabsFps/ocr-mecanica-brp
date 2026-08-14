import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const token =
  process.env.GITHUB_TOKEN ||
  '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';
const owner = '1GabsFps';
const repo = 'ocr-mecanica-brp';

const ignoreList = [
  'node_modules',
  '.git',
  'dist',
  '.gemini',
  'backups',
  'eng.traineddata',
  'por.traineddata',
  '.env.local',
  'bun.lock',
  'package-lock.json',
];

function getAllFiles(dir, baseDir = '') {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    if (ignoreList.includes(file)) continue;
    const fullPath = path.join(dir, file);
    const relPath = path.join(baseDir, file).replace(/\\/g, '/');
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllFiles(fullPath, relPath));
    } else {
      if (stat.size < 1024 * 1024) {
        results.push({ fullPath, relPath });
      }
    }
  }
  return results;
}

async function ghApi(endpoint, method = 'GET', body = null) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}${endpoint}`, {
    method,
    headers: {
      Authorization: `token ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Antigravity-AI',
    },
    body: body ? JSON.stringify(body) : null,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`${endpoint} failed: ${res.status} ${data.message || ''}`);
  }
  return data;
}

export async function syncToGitHub(commitMessage = 'Update codebase to latest version') {
  console.log(`🚀 Iniciando backup para GitHub (${owner}/${repo})...`);
  const files = getAllFiles(rootDir);
  console.log(`📦 Processando ${files.length} arquivos...`);

  const treeEntries = [];

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const content = fs.readFileSync(f.fullPath);
    const isBinary = f.relPath.match(/\.(png|jpg|jpeg|gif|ico|wasm|mp3)$/i);

    const blobData = await ghApi('/git/blobs', 'POST', {
      content: content.toString(isBinary ? 'base64' : 'utf-8'),
      encoding: isBinary ? 'base64' : 'utf-8',
    });

    treeEntries.push({
      path: f.relPath,
      mode: '100644',
      type: 'blob',
      sha: blobData.sha,
    });
  }

  const commits = await ghApi('/commits?per_page=1');
  const baseCommitSha = commits[0].sha;
  const baseTree = (await ghApi(`/git/commits/${baseCommitSha}`)).tree.sha;

  console.log('🌳 Criando Git Tree...');
  const tree = await ghApi('/git/trees', 'POST', {
    base_tree: baseTree,
    tree: treeEntries,
  });

  console.log(`📝 Criando Commit: "${commitMessage}"...`);
  const commit = await ghApi('/git/commits', 'POST', {
    message: commitMessage,
    tree: tree.sha,
    parents: [baseCommitSha],
  });

  console.log('⚡ Atualizando branch main...');
  await ghApi('/git/refs/heads/main', 'PATCH', {
    sha: commit.sha,
    force: true,
  });

  console.log(`✅ Backup no GitHub concluído com sucesso: https://github.com/${owner}/${repo}`);
}

const customMessage = process.argv.slice(2).join(' ') || undefined;
syncToGitHub(customMessage);
