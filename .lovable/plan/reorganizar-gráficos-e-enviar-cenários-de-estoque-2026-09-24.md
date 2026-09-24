# Reorganizar gráficos e enviar cenários de estoque

## Alterações
- Mover o **Heatmap de produção** para antes do bloco **Estoque acumulado e regressão**, mantendo os mesmos dados e filtros.
- Manter o simulador no fluxo atual e inserir **Enviar simulação** imediatamente antes de **Metodologia e memória de cálculo**.
- Reutilizar o envio server-side, os destinatários habilitados, o remetente configurado, os registros de envio e as mesmas mensagens de sucesso/erro.
- Montar o e-mail a partir do snapshot já gerado pelo simulador, incluindo parâmetros, resumo, projeções por cenário, alertas e dados técnicos, sem recalcular nem consultar a API.
- Bloquear cliques repetidos durante o envio e impedir envio antes de uma simulação válida.

## Detalhes técnicos
- O componente do simulador chamará a função de envio existente com o lote atual.
- A função existente aceitará também o formato do simulador e escolherá o conteúdo adequado, preservando integralmente o envio do gráfico atual.
- Nenhuma tabela, integração, chamada ao MES ou cálculo de regressão será criada ou alterada.

## Validação
- Conferir compilação, posição visual dos blocos, estado do botão e preservação do fluxo atual.
