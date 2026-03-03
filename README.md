# Top 20 Gainers - Bybit USDT Perpétuos (Ferramenta Avançada de Scalping)

Aplicação web React que exibe os 20 pares perpétuos USDT da Bybit com maiores valorizações em 24 horas, combinando análise técnica avançada com interface moderna.

## Recursos Principais

- ✨ **Análise Técnica Avançada** - Inclui momentum intraday (1h/4h), rejeição de níveis com força, score combinado para scalping
- 📊 **Interface Moderna** - Design dark com Tailwind CSS e ícones Lucide React
- ⚡ **Performance Otimizada** - React com memoização, callbacks e lazy loading
- 📱 **Responsivo** - Funciona em desktop, tablet e mobile
- 🎯 **Best Practices** - Padrões do Vercel, gerenciamento de estado eficiente
- 🔄 **Atualização em Tempo Real** - Dados atualizados a cada 60 segundos
- 🧠 **Sistema de Score** - Avaliação combinada de momentum, rejeição, liquidez, volume e volatilidade

## Tecnologias Utilizadas

- **React 18** - Library UI
- **Tailwind CSS** - Styling
- **Lucide React** - Ícones
- **CoinGecko API** - Dados de mercado (grátis, sem autenticação)
- **Bybit API** - Dados avançados (candlesticks, order book)
- **LocalStorage** - Caching de dados para melhor desempenho
- **Rate Limiter** - Controle de requisições para Bybit API

## Estrutura do Projeto

```bash
├── index.html          # App completa (React bundled)
├── index.jsx           # Componente React (referência)
├── package.json        # Metadados
├── setup.sh            # Script de setup
├── README.md           # Documentação
└── src/                # Pasta com componentes e lógica
    ├── components/     # Componentes reutilizáveis
    ├── hooks/          # Hooks customizados
    ├── utils/          # Funções utilitárias
    └── styles/         # Estilos globais
```

## Como Funciona

1. **Coleta de Dados**:
   - CoinGecko API para lista inicial de pares
   - Bybit API para dados avançados (candlesticks, order book)

2. **Processamento**:
   - Cálculo de momentum em múltiplos timeframes
   - Análise de rejeição de níveis com força
   - Cálculo de score combinado (momentum + rejeição + liquidez + volume + volatilidade)

3. **Exibição**:
   - Tabela com 20 pares mais relevantes
   - Painel de status com indicadores de frescor
   - Configuração de pesos para score

4. **Otimizações**:
   - React.memo para componentes de lista
   - useCallback para callbacks estáveis
   - Abort controller para timeouts
   - Caching com localStorage

## Otimizações Aplicadas

- ✅ React.memo para componentes de lista
- ✅ useCallback para callbacks estáveis
- ✅ Lazy state initialization
- ✅ Event delegation
- ✅ CSS classes (zero JS overhead)
- ✅ Abort controller para timeouts
- ✅ Caching com localStorage
- ✅ Rate limiting para Bybit API

## Licença

MIT