export interface ChangelogItem {
  title: string;
  description: string;
  type: 'feature' | 'improvement' | 'fix' | 'performance';
}

export interface ChangelogRelease {
  version: string;
  tag: string;
  date: string;
  title: string;
  items: ChangelogItem[];
}

export const CURRENT_APP_VERSION = '2.4.1';

export const CHANGELOG_DATA: ChangelogRelease[] = [
  {
    version: '2.4.1',
    tag: 'Atual',
    date: '13/08/2026',
    title: 'Otimização de Desempenho e Velocidade',
    items: [
      {
        title: 'Corrida Inteligente de Chaves (Hedged Racing)',
        description: 'Elimina travamentos de 10s a 20s acionando a chave secundária em paralelo caso a primeira demore mais de 1.5s no Google.',
        type: 'performance',
      },
    ],
  },
  {
    version: '2.4.0',
    tag: 'Anterior',
    date: '13/08/2026',
    title: 'Automação no Alt+Tab, Telemetria Global e Pipeline WebP',
    items: [
      {
        title: 'Auto-Colar ao dar Alt+Tab',
        description: 'Tire o print no FiveM e apenas alterne para a aba do site. A imagem é detectada e lida sozinha, sem precisar de Ctrl+V!',
        type: 'feature',
      },
      {
        title: 'Novo Painel de Configurações',
        description: 'Centralize preferências de Auto-Copiar, Auto-Colar e Chave de API própria em um modal flutuante com salvamento permanente.',
        type: 'feature',
      },
      {
        title: 'Métricas da Oficina em Tempo Real',
        description: 'Card com total de imagens enviadas no dia pela equipe toda, taxa de acerto e tempo médio de resposta via micro-serviço Docker.',
        type: 'feature',
      },
    ],
  },
  {
    version: '2.3.0',
    tag: 'Anterior',
    date: '12/08/2026',
    title: 'Aba Extra, Hífens e Histórico em HD',
    items: [
      {
        title: 'Aba Extra: Remoção de Peça',
        description: 'Nova opção combinável com todas as demais abas (Troca de Óleo, Tuning, Retífica ou Avulso).',
        type: 'feature',
      },
      {
        title: 'Visualizador de Histórico em HD',
        description: 'Ao restaurar serviços anteriores, o painel carrega a foto original nítida diretamente do Discord CDN com zoom e pan.',
        type: 'improvement',
      },
      {
        title: 'Preservação de Hífens nos Modelos',
        description: 'Suporte a nomes como F-150 RAPTOR, GT-R, CX-5 e CR-V sem remoção de traços de fábrica.',
        type: 'fix',
      },
    ],
  },
];
