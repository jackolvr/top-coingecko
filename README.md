# Bybit Top Gainers

## 📋 Resumo

Script Python 3.12+ que consome a API pública da CoinGecko e retorna os 20 pares perpétuos USDT com maior % de valorização em 24h na corretora Bybit.

## ✅ Funcionalidades

- ✓ Consome endpoint público `/derivatives` da CoinGecko
- ✓ Filtra pares Bybit (mercado "Bybit (Futures)")
- ✓ Filtra apenas contratos perpétuos USDT
- ✓ Ordena por maior valorização 24h
- ✓ Retorna top 20 com tabela formatada
- ✓ Type hints 100%
- ✓ Tratamento robusto de erros
- ✓ 19 testes unitários

## 🚀 Como Usar

### Instalação
```bash
pip install requests
```

### Executar
```bash
python bybit_top_gainers.py
```

### Saída Esperada
```
Buscando dados de derivativos da Bybit na CoinGecko...

╔═══════════════════════════════════════════════════════════╗
║ TOP 20 PARES PERPETUOS USDT — BYBIT                      ║
║ Maiores Valorizações em 24 horas                         ║
╚═══════════════════════════════════════════════════════════╝

+-----------+------------------+------------------+
| Par       | Preço (USD)      | Mudança 24h %    |
+-----------+------------------+------------------+
| POWERUSDT |       1.98       |       +115.30%   |
| RIVERUSDT |       10.84      |        +15.80%   |
| PIPPINUSDT|       0.7987     |         +5.60%   |
+-----------+------------------+------------------+

✓ Total: 20 pares USDT perpétuos encontrados
```

## 🧪 Testes

```bash
pip install pytest
pytest test_bybit_top_gainers.py -v
```

### Cobertura
- Validação de TabelaPar
- Filtragem Bybit USDT perpétuos
- Formatação de preços
- Tratamento de erros
- Casos extremos

## 📊 Arquitetura

### TabelaPar (Dataclass)
Representa um par com validação de dados

### ClienteCoinGecko
- `obter_pares_bybit()` - Orquestra busca e filtragem
- `_buscar_todos_tickers()` - Consome API
- `_filtrar_usdt_perpetuos()` - Filtra dados
- `_eh_par_valido()` - Validação individual

### FormatadorTabela
- `formatar_preco()` - Precisão adequada por faixa
- `exibir_tabela()` - Renderiza tabela ASCII

## 🔧 Detalhes da API

**Endpoint**: `GET /derivatives`  
**URL**: `https://api.coingecko.com/api/v3/derivatives`  
**Rate Limit**: 30 chamadas/min (plano gratuito)  
**Atualização**: A cada 30 segundos

### Filtros Aplicados
1. `market.contains("Bybit")` 
2. `symbol.endsWith("USDT")`
3. `contract_type == "perpetual"`
4. `price_percentage_change_24h != null`

## 🎯 Melhorias vs Original

| Item | Original | Corrigido |
|------|----------|-----------|
| Type Hints | ❌ | ✅ 100% |
| Testes | ❌ | ✅ 19 testes |
| Arquitetura | Procedural | OOP com 3 classes |
| Erro 401 | ❌ | ✅ Resolvido |
| Filtro Bybit | Incorreto | ✅ Correto (market) |
| Filtro USDT | target/quote | ✅ symbol.endsWith |
| Documentação | Mínima | Completa |

## 📝 Campos Utilizados do Ticker

```python
{
    "symbol": "BTCUSDT",           # Símbolo do par
    "market": "Bybit (Futures)",   # Exchange
    "price": 45000.5,             # Preço atual
    "price_percentage_change_24h": 2.5,  # Mudança 24h
    "contract_type": "perpetual"   # Tipo de contrato
}
```

## 🤝 Contribuição

Para melhorar:
1. Adicione testes em `test_bybit_top_gainers.py`
2. Mantenha type hints
3. Siga convenção de nomes pt-br
4. Execute `pytest` antes de commitar

---

**Status**: ✅ Produção  
**Python**: 3.12+  
**Licença**: MIT

