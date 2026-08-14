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

export const CURRENT_APP_VERSION = '2.4.2';

export const CHANGELOG_DATA: ChangelogRelease[] = [
  {
    version: '2.4.2',
    tag: 'Atual',
    date: '14/08/2026',
    title: 'Trava Anti-Duplicidade de Print e Failover Instantâneo',
    items: [
      {
        title: 'Proteção Contra Prints Repetidos',
        description: 'Se você colar o mesmo print de novo sem querer, o sistema mantém os dados na tela e copia na hora em 0ms sem precisar carregar novamente.',
        type: 'feature',
      },
      {
        title: 'Troca Instantânea de Chaves',
        description: 'Garante que a resposta da IA continue sempre rápida (~1.6s), alternando de chave na mesma fração de segundo se houver qualquer oscilação.',
        type: 'performance',
      },
    ],
  },
  {
    version: '2.4.1',
    tag: 'Anterior',
    date: '13/08/2026',
    title: 'Otimização de Desempenho e Velocidade',
    items: [
      {
        title: 'Corrida Inteligente de Chaves (Hedged Racing)',
        description: 'Elimina travamentos acionando a chave secundária em paralelo caso a primeira demore no Google.',
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
];
