import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { TrendingUp, AlertCircle, RefreshCw } from 'lucide-react';

// Configuração da API
const API_COINGECKO = 'https://api.coingecko.com/api/v3/derivatives';
const TIMEOUT_PADRAO = 15000;

// Hook customizado para buscar dados
function useFetchTopGainers() {
  const [estado_carregamento, setEstadoCarregamento] = useState(true);
  const [erro, setErro] = useState(null);
  const [pares, setPares] = useState([]);
  const [ultima_atualizacao, setUltimaAtualizacao] = useState(null);

  const buscar_pares = useCallback(async () => {
    setEstadoCarregamento(true);
    setErro(null);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_PADRAO);

      const resposta = await fetch(API_COINGECKO, {
        method: 'GET',
        headers: { 'accept': 'application/json' },
        signal: controller.signal,
        body: null,
        params: {
          include_tickers: 'perpetual',
          order: 'name',
          per_page: 100,
          page: 1
        }
      });

      clearTimeout(timeout);

      if (resposta.status === 429) {
        setErro('⚠️ Limite de requisições atingido. Tente novamente em alguns minutos.');
        setEstadoCarregamento(false);
        return;
      }

      if (!resposta.ok) {
        throw new Error(`Erro ${resposta.status}: ${resposta.statusText}`);
      }

      const dados = await resposta.json();
      const tickers_filtrados = Array.isArray(dados) ? dados : [];

      // Filtrar e transformar dados
      const pares_processados = tickers_filtrados
        .filter(ticker => _eh_par_valido(ticker))
        .map(ticker => ({
          simbolo: ticker.symbol,
          preco: parseFloat(ticker.price || ticker.last || 0),
          percentual_24h: parseFloat(ticker.price_percentage_change_24h || 0)
        }))
        .sort((a, b) => b.percentual_24h - a.percentual_24h)
        .slice(0, 20);

      setPares(pares_processados);
      setUltimaAtualizacao(new Date().toLocaleTimeString('pt-BR'));
    } catch (err) {
      const mensagem = err.name === 'AbortError' 
        ? 'Timeout: Requisição demorou muito.' 
        : err.message;
      setErro(`❌ ${mensagem}`);
    } finally {
      setEstadoCarregamento(false);
    }
  }, []);

  useEffect(() => {
    buscar_pares();
    const intervalo = setInterval(buscar_pares, 60000); // 1 minuto
    return () => clearInterval(intervalo);
  }, [buscar_pares]);

  return { pares, estado_carregamento, erro, ultima_atualizacao, buscar_pares };
}

// Validação de par
function _eh_par_valido(ticker) {
  const market = String(ticker.market || '').toLowerCase();
  const symbol = String(ticker.symbol || '');
  
  return (
    market.includes('bybit') &&
    symbol.endsWith('USDT') &&
    (ticker.contract_type || '').toLowerCase() === 'perpetual' &&
    ticker.price_percentage_change_24h != null
  );
}

// Formatador de preço
function formatar_preco(preco) {
  if (preco >= 1000) {
    return preco.toLocaleString('pt-BR', { 
      style: 'currency', 
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).replace('R$', '$');
  } else if (preco >= 1) {
    return `$${preco.toFixed(4)}`;
  } else {
    return `$${preco.toFixed(8)}`;
  }
}

// Componente Célula de Percentual
function CelulaMudanca({ percentual }) {
  const classe_cor = percentual >= 0 ? 'text-green-500' : 'text-red-500';
  return (
    <span className={`font-semibold ${classe_cor}`}>
      {percentual >= 0 ? '+' : ''}{percentual.toFixed(2)}%
    </span>
  );
}

// Componente Linha da Tabela
const LinhaTabela = React.memo(({ par }) => (
  <tr className="border-b border-slate-700 hover:bg-slate-800/50 transition-colors">
    <td className="px-6 py-4 text-left font-medium text-slate-100">{par.simbolo}</td>
    <td className="px-6 py-4 text-right font-mono text-slate-300">{formatar_preco(par.preco)}</td>
    <td className="px-6 py-4 text-right">
      <CelulaMudanca percentual={par.percentual_24h} />
    </td>
  </tr>
));

LinhaTabela.displayName = 'LinhaTabela';

// Componente Principal
export default function AplicacaoTopGainers() {
  const { pares, estado_carregamento, erro, ultima_atualizacao, buscar_pares } = useFetchTopGainers();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Grid de fundo */}
      <div className="absolute inset-0 opacity-5 pointer-events-none" 
        style={{
          backgroundImage: 'linear-gradient(0deg, transparent 24%, rgba(15,23,42,0.3) 25%, rgba(15,23,42,0.3) 26%, transparent 27%, transparent 74%, rgba(15,23,42,0.3) 75%, rgba(15,23,42,0.3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(15,23,42,0.3) 25%, rgba(15,23,42,0.3) 26%, transparent 27%, transparent 74%, rgba(15,23,42,0.3) 75%, rgba(15,23,42,0.3) 76%, transparent 77%, transparent)',
          backgroundSize: '50px 50px'
        }}
      />

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-12">
        {/* Cabeçalho */}
        <div className="mb-12 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="relative">
              <div className="absolute inset-0 bg-cyan-500 blur-xl opacity-30 rounded-full" />
              <TrendingUp className="relative w-12 h-12 text-cyan-400" strokeWidth={1.5} />
            </div>
            <h1 className="text-5xl font-bold text-white tracking-tight">
              Top 20 Gainers
            </h1>
          </div>
          <p className="text-slate-400 text-lg mb-2">Pares Perpétuos USDT da Bybit</p>
          <p className="text-slate-500 text-sm">Maiores Valorizações em 24 horas</p>
        </div>

        {/* Cartão Principal */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-xl shadow-2xl overflow-hidden">
          {/* Barra de Ação */}
          <div className="flex items-center justify-between px-8 py-5 bg-slate-800/40 border-b border-slate-800">
            <div className="text-sm text-slate-400">
              {ultima_atualizacao && (
                <span>Atualizado às <span className="text-cyan-400 font-semibold">{ultima_atualizacao}</span></span>
              )}
            </div>
            <button
              onClick={buscar_pares}
              disabled={estado_carregamento}
              className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all font-medium text-sm"
            >
              <RefreshCw className={`w-4 h-4 ${estado_carregamento ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
          </div>

          {/* Conteúdo */}
          {erro ? (
            <div className="p-8">
              <div className="flex items-start gap-3 p-4 bg-red-950/30 border border-red-800/50 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-red-200">{erro}</p>
              </div>
            </div>
          ) : estado_carregamento && pares.length === 0 ? (
            <div className="p-12 text-center">
              <div className="inline-flex flex-col items-center gap-4">
                <div className="relative w-12 h-12">
                  <div className="absolute inset-0 bg-cyan-500 rounded-full animate-pulse" />
                  <div className="absolute inset-2 bg-slate-900 rounded-full" />
                </div>
                <p className="text-slate-400">Carregando dados...</p>
              </div>
            </div>
          ) : pares.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              Nenhum par encontrado
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-800/60 border-b border-slate-700">
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Par</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">Preço (USD)</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">Mudança 24h</th>
                  </tr>
                </thead>
                <tbody>
                  {pares.map((par, indice) => (
                    <LinhaTabela key={par.simbolo} par={par} />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Rodapé */}
          {pares.length > 0 && (
            <div className="px-8 py-4 bg-slate-800/40 border-t border-slate-800 text-sm text-slate-400">
              ✓ <span className="font-semibold text-slate-300">{pares.length}</span> pares USDT perpétuos encontrados
            </div>
          )}
        </div>

        {/* Informações */}
        <div className="mt-8 text-center text-xs text-slate-500">
          <p>Dados fornecidos pela <span className="text-slate-400 font-medium">CoinGecko API</span></p>
        </div>
      </div>
    </div>
  );
}
