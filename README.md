# Production Predictor

crie uma aplicação de gêmio digital que consuma dados de uma API de um sistema mes cuja URL do swager (https://mina.com.br/integration/swagger/index.html), Api integrations (https://mina.com.br/integration/swagger/v1/swagger.json) fazendo consultas no endpoint (/v1/ProductionCount/{startDate}/{endDate}). Criei um código inicial para realizar a consulta e gerar um gráfico de regreção, no entanto ao realizar a consulta não garanto que esse código é um gemio digital porque a consulta aos dados não é automática e nem em tempo real. Dessa forma essa consulta precisa ser automática a cada 5 segundos e após o estabelecimento dessa rotina automatica e posteriormente as informações são trabalhadas para geração do gráfico, campos e demais processos.


# ==========================================================

# INSTALAÇÃO

# ==========================================================




!pip install -q requests pandas numpy scikit-learn matplotlib ipywidgets




# ==========================================================

# IMPORTS

# ==========================================================




import requests

import pandas as pd

import numpy as np




from sklearn.linear_model import LinearRegression




import matplotlib.pyplot as plt

import matplotlib.dates as mdates




import ipywidgets as widgets




from IPython.display import display, clear_output




# ==========================================================

# CONFIGURAÇÃO API

# ==========================================================




BASE_URL = "https://mina.com.br/integration/v1"




API_KEY = "3E32D3C4A36E491AA7E7D911D1096442"




HEADERS = {

    "ApiKey": API_KEY,

    "accept": "application/json"

}




WORKCENTER = "LINHA 1 GARRAFÃO 20L"




START_DATE = "2025-01-01T00:00:00Z"

END_DATE   = "2025-12-31T23:59:59Z"




# ==========================================================

# BUSCA DADOS API

# ==========================================================




def obter_dados_mes():




    url = (

        f"{BASE_URL}/ProductionCount/"

        f"{START_DATE}/{END_DATE}"

    )




    response = requests.get(

        url,

        headers=HEADERS,

        timeout=60

    )




    response.raise_for_status()




    df = pd.DataFrame(

        response.json()

    )




    df["date"] = pd.to_datetime(df["date"])




    return df





print("Buscando dados MES...")




df_api = obter_dados_mes()




print(

    f"{len(df_api)} registros carregados."

)




print(

    df_api["workCenter"].unique()

)




df_api = df_api[

    df_api["workCenter"] == WORKCENTER

].copy()




print(

    f"{len(df_api)} registros para {WORKCENTER}"

)




# ==========================================================

# PREPARA SÉRIE

# ==========================================================




def preparar_serie(df, qtd_dias):




    dados = df.copy()




    dados["totalQuantity"] = pd.to_numeric(

        dados["totalQuantity"],

        errors="coerce"

    )




    dados = dados.dropna(

        subset=["totalQuantity"]

    )




    # Agrupar por data e somar produção diária

    dados = (

        dados

        .groupby("date")["totalQuantity"]

        .sum()

        .reset_index()

    )




    dados = dados.sort_values(

        "date"

    )




    # Criar série temporal completa com todos os dias

    data_min = dados["date"].min()

    data_max = dados["date"].max()




    # Criar dataframe com todos os dias do período

    datas_completas = pd.date_range(start=data_min, end=data_max, freq='D')

    df_completo = pd.DataFrame({'date': datas_completas})




    # Fazer merge com os dados existentes (preenchendo dias sem produção com 0)

    dados = pd.merge(df_completo, dados, on='date', how='left')

    dados['totalQuantity'] = dados['totalQuantity'].fillna(0)




    # Pegar os últimos qtd_dias dias

    dados = dados.tail(qtd_dias)




    # Criar coluna de dia sequencial

    dados["dia"] = np.arange(1, len(dados) + 1)




    # Calcular estoque acumulado CORRETAMENTE

    dados["estoque"] = dados["totalQuantity"].cumsum()




    # Aplicar média móvel para suavizar

    dados["estoque_suavizado"] = dados["estoque"].rolling(window=7, min_periods=1).mean()




    return dados




# ==========================================================

# CONTROLES

# ==========================================================




dias_observados = widgets.IntText(

    value=365,

    description="Quantidade de dias com dados observados:"

)




dia_consulta = widgets.IntText(

    value=400,

    description="Dia que deseja verificar:"

)




limite_estoque = widgets.IntSlider(

    value=10000,

    min=1000,

    max=1000000,

    step=100,

    description="Limite máximo:"

)




# ==========================================================

# FUNÇÃO PARA CRIAR GRÁFICO

# ==========================================================




def criar_grafico(dados, futuro, consulta, limite, estoque_consulta, modelo):




    fig, ax = plt.subplots(figsize=(12, 6))




    # DEBUG - Verificar se há dados

    print(f"Dados shape: {dados.shape}")

    print(f"Colunas: {dados.columns}")

    print(f"Primeiros 5 dias: {dados.head()}")




    # 1. Plotar todos os pontos de estoque (incluindo zeros)

    ax.scatter(dados["dia"], dados["estoque"],

               color='gray', s=15, alpha=0.5, label='Todos os dias', zorder=1)




    # 2. Plotar apenas pontos com produção > 0

    dados_com_producao = dados[dados["totalQuantity"] > 0]

    if len(dados_com_producao) > 0:

        ax.scatter(dados_com_producao["dia"], dados_com_producao["estoque"],

                   color='black', s=30, label='Dias com produção', zorder=2)




    # 3. Plotar linha de estoque suavizado

    ax.plot(dados["dia"], dados["estoque_suavizado"],

            color='orange', linewidth=2, label='Estoque suavizado (MM7)', zorder=1)




    # 4. Linha de previsão linear

    ax.plot(futuro["dia"], futuro["previsao"],

            color='blue', linewidth=2, label='Regressão linear', zorder=1)




    # 5. Linha do limite

    ax.axhline(y=limite, color='red', linestyle='--', linewidth=2,

               label=f'Limite: {limite}', zorder=1)




    # 6. Linha do dia consultado

    ax.axvline(x=consulta, color='green', linestyle=':', linewidth=2,

               label=f'Dia: {consulta}', zorder=1)




    # 7. Ponto consultado

    if consulta <= len(futuro):

        ax.scatter(consulta, estoque_consulta,

                   color='green', s=150, marker='*',

                   edgecolors='darkgreen', linewidth=2,

                   label=f'Previsão dia {consulta}: {estoque_consulta:,.0f}', zorder=3)




    ax.set_title('Previsão do Estoque Acumulado', fontsize=16, fontweight='bold', pad=20)

    ax.set_xlabel('Dia', fontsize=12)

    ax.set_ylabel('Estoque acumulado', fontsize=12)




    ax.grid(True, alpha=0.3, linestyle='--')

    ax.set_axisbelow(True)




    ax.legend(loc='upper left', fontsize=9, framealpha=0.9)




    # Ajustar limites

    x_max = max(consulta + 50, futuro["dia"].max() if len(futuro) > 0 else 100)

    ax.set_xlim(0, x_max)




    y_max = max(limite * 1.1, dados["estoque"].max() * 1.1)

    ax.set_ylim(0, y_max)




    ax.xaxis.set_major_locator(plt.MaxNLocator(10))




    plt.tight_layout()

    return fig




# ==========================================================

# FUNÇÃO PRINCIPAL

# ==========================================================




def atualizar(*args):




    clear_output(wait=True)




    dias = dias_observados.value

    consulta = dia_consulta.value

    limite = limite_estoque.value




    print(f"Processando com dias={dias}, consulta={consulta}, limite={limite}")




    dados = preparar_serie(df_api, dias)




    if len(dados) < 2:

        display(widgets.HTML("<h1>Previsão de Estoque com Regressão Linear</h1>"))

        print("Dados insuficientes para previsão.")

        return




    print(f"Dados preparados: {len(dados)} registros")

    print(f"Estoque máximo: {dados['estoque'].max():,.0f}")

    print(f"Estoque mínimo: {dados['estoque'].min():,.0f}")

    print(f"Produção total: {dados['totalQuantity'].sum():,.0f}")




    # Treinar modelo com dados suavizados

    X = dados[["dia"]]

    y = dados["estoque_suavizado"]




    modelo = LinearRegression()

    modelo.fit(X, y)




    print(f"Coeficiente: {modelo.coef_[0]:.2f}")

    print(f"Intercepto: {modelo.intercept_:.2f}")




    # Criar previsão

    ultimo_dia = max(consulta + 100, dados["dia"].max() + 100)

    futuro = pd.DataFrame({

        "dia": np.arange(1, ultimo_dia + 1)

    })

    futuro["previsao"] = modelo.predict(futuro[["dia"]])




    # Previsão para o dia consultado

    if consulta <= len(futuro):

        estoque_consulta = futuro.loc[futuro["dia"] == consulta, "previsao"].iloc[0]

    else:

        estoque_consulta = 0




    atingiu_limite = estoque_consulta >= limite




    # Criar resultado

    if atingiu_limite:

        resultado_texto = f"""

        <h2>Resultado</h2>

        <p>No dia {consulta} o estoque previsto é de {estoque_consulta:,.2f} unidades.</p>

        <p><strong style="color: red;">⚠️ Portanto, o limite de {limite} já foi atingido.</strong></p>

        <hr>

        <p><small>Equação: Estoque = {modelo.coef_[0]:.2f} × Dia + {modelo.intercept_:.2f}</small></p>

        """

    else:

        resultado_texto = f"""

        <h2>Resultado</h2>

        <p>No dia {consulta} o estoque previsto é de {estoque_consulta:,.2f} unidades.</p>

        <p><strong style="color: green;">✅ Portanto, o limite de {limite} ainda não foi atingido.</strong></p>

        <hr>

        <p><small>Equação: Estoque = {modelo.coef_[0]:.2f} × Dia + {modelo.intercept_:.2f}</small></p>

        """




    # Painéis

    painel_esquerdo = widgets.VBox([

        widgets.HTML("<h2>Parâmetros</h2>"),

        dias_observados,

        widgets.HTML("<br>"),

        dia_consulta,

        widgets.HTML("<br>"),

        limite_estoque

    ], layout=widgets.Layout(

        width="30%",

        border="1px solid lightgray",

        padding="15px"

    ))




    painel_direito = widgets.VBox([

        widgets.HTML(resultado_texto)

    ], layout=widgets.Layout(

        width="70%",

        padding="15px"

    ))




    painel = widgets.HBox([painel_esquerdo, painel_direito])




    # Criar gráfico

    fig = criar_grafico(dados, futuro, consulta, limite, estoque_consulta, modelo)




    # Título

    titulo = widgets.HTML("<h1 style='text-align: center;'>Previsão de Estoque com Regressão Linear</h1>")




    # Exibir tudo

    display(titulo)

    display(painel)




    # Exibir gráfico

    plt.show(fig)




    print("\n✅ Gráfico gerado com sucesso!")




# ==========================================================

# EVENTOS

# ==========================================================




dias_observados.observe(atualizar, names='value')

dia_consulta.observe(atualizar, names='value')

limite_estoque.observe(atualizar, names='value')




# ==========================================================

# INICIAR

# ==========================================================




atualizar()

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://mina-prod-trend.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/b5b08658-6e64-41e7-9676-b1da8f497b20).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
