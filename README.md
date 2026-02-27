# Top 20 Gainers - Bybit USDT Perpétuos

Aplicação web React que exibe os 20 pares perpétuos USDT da Bybit com maiores valorizações em 24 horas.

**Repositório**: https://github.com/jackolvr/top-coingecko
**Web App (Pages)**: https://jackolvr.github.io/top-coingecko

## Recursos

- ✨ **Atualização em tempo real** - Dados atualizados a cada minuto
- 📊 **Interface moderna** - Design dark com Tailwind CSS
- ⚡ **Performance otimizada** - React com memoização e callbacks
- 📱 **Responsivo** - Funciona em desktop, tablet e mobile
- 🎯 **Best practices** - Vercel React patterns aplicados

## Tecnologias

- **React 18** - Library UI
- **Tailwind CSS** - Styling
- **Lucide React** - Ícones
- **CoinGecko API** - Dados de mercado (grátis, sem autenticação)

## Deploy no Branch Pages

### Setup Automático

```bash
# No diretório do repositório
chmod +x setup.sh
./setup.sh
```

### Setup Manual

```bash
# 1. Adicionar arquivos à branch pages
git checkout -b pages
cp index.html index.jsx package.json README.md .

# 2. Commit e push
git add .
git commit -m "feat: bybit top gainers web app"
git push -u origin pages
```

### Configurar GitHub Pages

1. Repositório → **Settings** → **Pages**
2. **Source**: Deploy from a branch
3. **Branch**: `pages` / `/ (root)`
4. **Save**

⏱️ Site disponível em 2-3 minutos:
```
https://jackolvr.github.io/top-coingecko/
```

## Estrutura

```
├── index.html          # App completa (React bundled)
├── index.jsx           # Componente React (referência)
├── package.json        # Metadados
├── setup.sh            # Script de setup
└── README.md           # Documentação
```

## Como Funciona

1. **Busca**: CoinGecko API `/derivatives`
2. **Filtro**: Apenas USDT perpétuos da Bybit
3. **Ordenação**: Por % ganho em 24h
4. **Exibição**: Top 20 em tabela
5. **Atualização**: A cada 60s automaticamente

## Otimizações Aplicadas

- ✅ React.memo para componentes de lista
- ✅ useCallback para callbacks estáveis
- ✅ Lazy state initialization
- ✅ Event delegation
- ✅ CSS classes (zero JS overhead)
- ✅ Abort controller para timeouts

## Licença

MIT
