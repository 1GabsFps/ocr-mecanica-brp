import sqlite3, time

conn = sqlite3.connect('/home/ubuntu/mec-telemetry/data/telemetry.db')
c = conn.cursor()

c.execute('DELETE FROM inventory')

items = [
  ('item-aditivo-radiadores', 'Aditivo para Radiadores', 'fluidos', 2055, 500, 'un', 'Droplets', 'Aditivo concentrado protetor para sistema de arrefecimento e radiador.'),
  ('item-agua-desmineralizada', 'Agua Desmineralizada', 'fluidos', 6484, 1000, 'L', 'Droplets', 'Água pura deionizada para arrefecimento e diluição de aditivos.'),
  ('item-filtro-oleo', 'Filtro de Óleo', 'motor', 3642, 500, 'un', 'Layers', 'Filtro de óleo para retenção de impurezas na troca de óleo.'),
  ('item-junta-cabecote', 'Junta do Cabeçote', 'motor', 1015, 200, 'un', 'Layers', 'Junta de vedação de alta compressão para bloco e cabeçote.'),
  ('item-kit-cabecote-original', 'Kit Cabeçote Original', 'motor', 554, 150, 'un', 'Settings', 'Conjunto completo de cabeçote com válvulas e comandos.'),
  ('item-kit-martelinho', 'Kit Martelinho de Ouro', 'ferramentas', 1390, 300, 'un', 'Wrench', 'Ferramentas de desamassamento e funilaria sem danificar pintura.'),
  ('item-kit-aneis', 'Kit de Anéis', 'motor', 823, 200, 'un', 'CircleDot', 'Anéis de compressão e raspadores de óleo para pistões.'),
  ('item-kit-bronzinas', 'Kit de Bronzinas', 'motor', 808, 200, 'un', 'Disc', 'Bronzinas de biela e mancais para redução de atrito no virabrequim.'),
  ('item-kit-veiculos-afogados', 'Kit para veículos afogados (inacessíveis)', 'ferramentas', 113, 50, 'un', 'Shield', 'Equipamento de resgate para recuperação de veículos submersos.'),
  ('item-material-blocos', 'Material para Blocos de Motor', 'motor', 5559, 1000, 'un', 'Box', 'Matéria-prima de fundição para usinagem e reparo de blocos.'),
  ('item-reparo-radiadores', 'Reparo para Radiadores', 'motor', 1042, 200, 'un', 'Tool', 'Kit de vedação e reparo rápido para vazamento de radiadores.'),
  ('item-litro-oleo', 'Litro de Óleo', 'fluidos', 1159, 300, 'L', 'Droplets', 'Óleo lubrificante de alta performance para motores.'),
  ('item-radiador-original', 'Radiador Original', 'motor', 703, 150, 'un', 'Layers', 'Radiador de alumínio original para substituição e troca.'),
  ('item-pao', 'Pão', 'outros', 5727, 1000, 'un', 'Package', 'Suprimento alimentar para os mecânicos em serviço.'),
  ('item-redbull', 'Redbull', 'outros', 6231, 1000, 'un', 'Zap', 'Energético para os mecânicos durante turnos longos.'),
  ('item-kit-remocao-upgrade', 'Kit de remoção de Upgrade (mecânicos)', 'ferramentas', 916, 200, 'un', 'Wrench', 'Ferramenta especializada para desmontagem e extração de tunings.'),
  ('item-kit-direcao-racing', 'Kit de Direção Racing', 'performance', 139, 50, 'un', 'Gauge', 'Caixa de direção hidráulica aliviada com resposta ultra-rápida.'),
  ('item-bloco-motor-3cil', 'Bloco de Motor 3 cilindros', 'motor', 8, 20, 'un', 'Settings', 'Bloco de motor montado para veículos compactos.'),
  ('item-galao-combustivel', 'Galão de Combustível', 'fluidos', 34, 50, 'un', 'Fuel', 'Galão portátil de reabastecimento emergencial.'),
  ('item-kit-limpeza-paninho', 'Kit limpeza de veículo (paninho)', 'ferramentas', 67, 100, 'un', 'Sparkles', 'Panos de microfibra para lavagem e acabamento estético.'),
  ('item-radio', 'Radio', 'outros', 138, 50, 'un', 'Radio', 'Rádio comunicador de frequência da oficina.'),
  ('item-sanduiche', 'Sanduiche', 'outros', 387, 200, 'un', 'Package', 'Suprimento alimentar completo para os mecânicos.'),
  ('item-kit-pneus-drift', 'Kit de Pneus de Drift', 'pneus', 64, 80, 'un', 'CircleDot', 'Pneus de baixa aderência específicos para manobras de drift.'),
  ('item-combustivel', 'Combustível', 'fluidos', 8161, 2000, 'L', 'Fuel', 'Combustível automotivo para abastecimento na oficina.'),
  ('item-agua', 'Água', 'outros', 87, 200, 'un', 'Droplets', 'Garrafas de água mineral para hidratação da equipe.')
]

now_ms = int(time.time() * 1000)
for it in items:
    c.execute('''
        INSERT INTO inventory (id, nome, categoria, quantidade_atual, meta_minima, unidade, icone, descricao, ultima_atualizacao, atualizado_por)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Vincent Montgomery')
    ''', (it[0], it[1], it[2], it[3], it[4], it[5], it[6], it[7], now_ms))

conn.commit()
print('Inseridos', len(items), 'itens no banco com sucesso!')
