import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { TrendingUp, AlertCircle, RefreshCw } from 'lucide-react';

// Configuração da API
const API_COINGECKO = 'https://api.coingecko.com/api/v3/derivatives';
const TIMEOUT_PADRAO = 15000;

// ---- US-001: Bybit Candlesticks ----
const CORS_PROXY = 'https://api.allorigins.win/raw?url=';
const BYBIT_BASE = 'https://api.bybit.com/v5';
const CACHE_TTL_CANDLESTICKS = 60000; // 60s

class RateLimiter {
  constructor(maxCallsPerSecond) {
    this.maxCallsPerSecond = maxCallsPerSecond;
    this.queue = [];
    this.callTimestamps = [];
    this.processing = false;
  }

  execute(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      if (!this.processing) this._processQueue();
    });
  }

  async _processQueue() {
    this.processing = true;
    while (this.queue.length > 0) {
      const now = Date.now();
      this.callTimestamps = this.callTimestamps.filter(ts => now - ts < 1000);
      if (this.callTimestamps.length >= this.maxCallsPerSecond) {
        const waitTime = 1000 - (now - this.callTimestamps[0]) + 1;
        await new Promise(r => setTimeout(r, waitTime));
        continue;
      }
      const { fn, resolve, reject } = this.queue.shift();
      this.callTimestamps.push(Date.now());
      try { resolve(await fn()); } catch (e) { reject(e); }
    }
    this.processing = false;
  }
}

const bybitRateLimiter = new RateLimiter(20);

function _obter_cache_candlesticks(symbol) {
  try {
    const chave = `scalping_cache_${symbol}`;
    const cached = localStorage.getItem(chave);
    if (!cached) return null;
    const dados = JSON.parse(cached);
    if (Date.now() - dados.timestamp_cache < CACHE_TTL_CANDLESTICKS) {
      return dados.candlesticks || null;
    }
    return null;
  } catch (e) { return null; }
}

function _salvar_cache_candlesticks(symbol, candlesticks) {
  try {
    const chave = `scalping_cache_${symbol}`;
    const existente = JSON.parse(localStorage.getItem(chave) || '{}');
    localStorage.setItem(chave, JSON.stringify({
      ...existente,
      candlesticks,
      timestamp_cache: Date.now()
    }));
  } catch (e) {
    console.warn('[Cache] Falha ao salvar candlesticks:', e);
  }
}

async function buscar_candlesticks_bybit(symbol, intervalos = ['60', '240']) {
  const cache = _obter_cache_candlesticks(symbol);
  if (cache) return cache;

  const resultados = [];
  for (const intervalo of intervalos) {
    try {
      const url = `${BYBIT_BASE}/market/kline?symbol=${symbol}&interval=${intervalo}&limit=5`;
      const proxyUrl = `${CORS_PROXY}${encodeURIComponent(url)}`;
      const resposta = await bybitRateLimiter.execute(async () => {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 8000);
        try {
          const res = await fetch(proxyUrl, { signal: ctrl.signal });
          clearTimeout(t);
          return res;
        } catch (e) { clearTimeout(t); throw e; }
      });
      if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
      const dados = await resposta.json();
      if (dados.retCode !== 0 || !dados.result?.list?.length) {
        throw new Error(`Bybit: ${dados.retMsg || 'sem dados'}`);
      }
      // Bybit kline: [timestamp, open, high, low, close, volume, turnover]
      dados.result.list.forEach(kline => {
        resultados.push({
          symbol,
          interval: intervalo,
          open: parseFloat(kline[1]),
          high: parseFloat(kline[2]),
          low: parseFloat(kline[3]),
          close: parseFloat(kline[4]),
          volume: parseFloat(kline[5]),
          timestamp: parseInt(kline[0])
        });
      });
    } catch (err) {
      console.warn(`[Bybit] candlesticks ${symbol} ${intervalo}:`, err.message);
    }
  }

  if (resultados.length > 0) {
    _salvar_cache_candlesticks(symbol, resultados);
    return resultados;
  }

  // Fallback: cache stale
  try {
    const chave = `scalping_cache_${symbol}`;
    const cached = localStorage.getItem(chave);
    if (cached) {
      const dados = JSON.parse(cached);
      if (dados.candlesticks?.length) {
        console.warn(`[Bybit] Cache stale para ${symbol}`);
        return dados.candlesticks;
      }
    }
  } catch (e) { /* ignore */ }
  return [];
}
// ---- fim US-001 ----

// ---- US-002: Momentum Intraday ----
function calcular_momentum(candlesticks) {
  if (!candlesticks || candlesticks.length === 0) {
    return { percentual_1h: null, percentual_4h: null, status: 'sem_dados' };
  }

  // Agrupar por intervalo; Bybit retorna mais recente primeiro (index 0 = atual, index 1 = primeira vela)
  const por_intervalo = {};
  candlesticks.forEach(c => {
    if (!por_intervalo[c.interval]) por_intervalo[c.interval] = [];
    por_intervalo[c.interval].push(c);
  });

  function _calcular_percentual(candles) {
    if (!candles || candles.length < 2) return null;
    const close_atual = candles[0].close;
    const open_primeira_vela = candles[1].open;
    if (open_primeira_vela === 0) return null;
    return ((close_atual - open_primeira_vela) / open_primeira_vela) * 100;
  }

  const percentual_1h = _calcular_percentual(por_intervalo['60']);
  const percentual_4h = _calcular_percentual(por_intervalo['240']);

  function _eh_em_formacao(pct) {
    if (pct === null) return false;
    const abs = Math.abs(pct);
    return abs > 2 && abs < 10;
  }

  const formacao_1h = _eh_em_formacao(percentual_1h);
  const formacao_4h = _eh_em_formacao(percentual_4h);

  let status;
  if (formacao_1h && formacao_4h) {
    status = 'em_formacao_confirmada';
  } else if (formacao_1h || formacao_4h) {
    status = 'em_formacao';
  } else {
    status = 'falso_sinal';
  }

  return { percentual_1h, percentual_4h, status };
}
// ---- fim US-002 ----

// ---- US-003: Rejeição de Níveis ----
function analisar_rejeicao_niveis(candlesticks) {
  if (!candlesticks || candlesticks.length === 0) {
    return { tem_rejeicao: false, tipo: 'nenhuma', forca: 0 };
  }

  // Agrupar por intervalo
  const por_intervalo = {};
  candlesticks.forEach(c => {
    if (!por_intervalo[c.interval]) por_intervalo[c.interval] = [];
    por_intervalo[c.interval].push(c);
  });

  function _calcular_sma_volume(candles) {
    if (!candles || candles.length === 0) return 0;
    return candles.reduce((sum, c) => sum + c.volume, 0) / candles.length;
  }

  function _calcular_forca(wick_size, candle_body) {
    if (candle_body === 0) return wick_size > 0 ? 10 : 0;
    const ratio = wick_size / candle_body;
    return Math.round(Math.min(10, Math.max(1, ratio * 2)));
  }

  function _analisar_intervalo(candles) {
    if (!candles || candles.length === 0) {
      return { tem_rejeicao: false, tipo: 'nenhuma', forca: 0 };
    }

    const vela = candles[0]; // mais recente (Bybit retorna desc)
    const sma_volume = _calcular_sma_volume(candles);
    if (vela.volume <= sma_volume) {
      return { tem_rejeicao: false, tipo: 'nenhuma', forca: 0 };
    }

    const wick_topo = vela.high - vela.close;
    const wick_fundo = vela.close - vela.low;
    const candle_body = Math.abs(vela.close - vela.open);

    // Lógica: rejeição topo se wick_topo > (close - low) * 0.5
    const tem_rejeicao_topo = wick_topo > (vela.close - vela.low) * 0.5;
    // Lógica: rejeição fundo se wick_fundo > (high - close) * 0.5
    const tem_rejeicao_fundo = wick_fundo > (vela.high - vela.close) * 0.5;

    if (tem_rejeicao_topo && wick_topo >= wick_fundo) {
      return { tem_rejeicao: true, tipo: 'rejeicao_topo', forca: _calcular_forca(wick_topo, candle_body) };
    } else if (tem_rejeicao_fundo) {
      return { tem_rejeicao: true, tipo: 'rejeicao_fundo', forca: _calcular_forca(wick_fundo, candle_body) };
    } else if (tem_rejeicao_topo) {
      return { tem_rejeicao: true, tipo: 'rejeicao_topo', forca: _calcular_forca(wick_topo, candle_body) };
    }
    return { tem_rejeicao: false, tipo: 'nenhuma', forca: 0 };
  }

  const resultados = Object.values(por_intervalo).map(_analisar_intervalo);
  const com_rejeicao = resultados.filter(r => r.tem_rejeicao);
  if (com_rejeicao.length === 0) {
    return { tem_rejeicao: false, tipo: 'nenhuma', forca: 0 };
  }

  // Retorna a rejeição mais forte entre os intervalos
  return com_rejeicao.reduce((best, curr) => curr.forca > best.forca ? curr : best);
}
// ---- fim US-003 ----

// ---- US-004: Order Book e Cost-to-Move ----
const CACHE_TTL_ORDER_BOOK = 5000; // 5s
const COST_TO_MOVE_MIN_USD = 50000; // $50K

function _obter_cache_order_book(symbol) {
  try {
    const chave = `scalping_cache_${symbol}`;
    const cached = localStorage.getItem(chave);
    if (!cached) return null;
    const dados = JSON.parse(cached);
    if (dados.order_book && Date.now() - (dados.timestamp_order_book || 0) < CACHE_TTL_ORDER_BOOK) {
      return dados.order_book;
    }
    return null;
  } catch (e) { return null; }
}

function _salvar_cache_order_book(symbol, order_book) {
  try {
    const chave = `scalping_cache_${symbol}`;
    const existente = JSON.parse(localStorage.getItem(chave) || '{}');
    localStorage.setItem(chave, JSON.stringify({
      ...existente,
      order_book,
      timestamp_order_book: Date.now()
    }));
  } catch (e) {
    console.warn('[Cache] Falha ao salvar order book:', e);
  }
}

async function buscar_order_book(symbol, limit = 20) {
  const cache = _obter_cache_order_book(symbol);
  if (cache) return cache;

  try {
    const url = `${BYBIT_BASE}/market/orderbook?symbol=${symbol}&limit=${limit}`;
    const proxyUrl = `${CORS_PROXY}${encodeURIComponent(url)}`;
    const resposta = await bybitRateLimiter.execute(async () => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      try {
        const res = await fetch(proxyUrl, { signal: ctrl.signal });
        clearTimeout(t);
        return res;
      } catch (e) { clearTimeout(t); throw e; }
    });
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    const dados = await resposta.json();
    if (dados.retCode !== 0 || !dados.result) {
      throw new Error(`Bybit: ${dados.retMsg || 'sem dados'}`);
    }
    // Bybit v5 order book: b = bids [[price, size],...] desc, a = asks [[price, size],...] asc
    const bids = (dados.result.b || []).map(([price, size]) => ({
      price: parseFloat(price),
      size: parseFloat(size)
    }));
    const asks = (dados.result.a || []).map(([price, size]) => ({
      price: parseFloat(price),
      size: parseFloat(size)
    }));
    const order_book = { bids, asks, timestamp: Date.now() };
    _salvar_cache_order_book(symbol, order_book);
    return order_book;
  } catch (err) {
    console.warn(`[Bybit] order book ${symbol}:`, err.message);
    // Fallback: cache stale
    try {
      const chave = `scalping_cache_${symbol}`;
      const cached = localStorage.getItem(chave);
      if (cached) {
        const dados = JSON.parse(cached);
        if (dados.order_book?.bids?.length) {
          console.warn(`[Bybit] Cache stale order book para ${symbol}`);
          return dados.order_book;
        }
      }
    } catch (e) { /* ignore */ }
    return null;
  }
}

function calcular_cost_to_move(order_book) {
  if (!order_book || !order_book.bids?.length || !order_book.asks?.length) {
    return { cost_to_move_up_usd: 0, cost_to_move_down_usd: 0, spread_atual: 0, tem_liquidez: false };
  }

  const melhor_bid = order_book.bids[0]?.price || 0;
  const melhor_ask = order_book.asks[0]?.price || 0;
  const preco_medio = (melhor_bid + melhor_ask) / 2;
  if (preco_medio === 0) {
    return { cost_to_move_up_usd: 0, cost_to_move_down_usd: 0, spread_atual: 0, tem_liquidez: false };
  }

  const spread_atual = melhor_ask > 0 ? ((melhor_ask - melhor_bid) / melhor_ask) * 100 : 0;

  // Cost to move UP 1%: accumulate ask volume until price > preco_medio * 1.01
  const preco_alvo_up = preco_medio * 1.01;
  let cost_to_move_up_usd = 0;
  for (const nivel of order_book.asks) {
    if (nivel.price > preco_alvo_up) break;
    cost_to_move_up_usd += nivel.price * nivel.size;
  }

  // Cost to move DOWN 1%: accumulate bid volume until price < preco_medio * 0.99
  const preco_alvo_down = preco_medio * 0.99;
  let cost_to_move_down_usd = 0;
  for (const nivel of order_book.bids) {
    if (nivel.price < preco_alvo_down) break;
    cost_to_move_down_usd += nivel.price * nivel.size;
  }

  const tem_liquidez = cost_to_move_up_usd >= COST_TO_MOVE_MIN_USD && cost_to_move_down_usd >= COST_TO_MOVE_MIN_USD;

  return { cost_to_move_up_usd, cost_to_move_down_usd, spread_atual, tem_liquidez };
}
// ---- fim US-004 ----

// ---- US-005: Score Combinado ----
const SCORE_HISTORY_KEY = 'scalping_scores_history';
const SCORE_HISTORY_MAX = 100;

// Pesos: momentum(10pts) + rejeicao(20pts) + liquidez(15pts) + volume(30pts) + volatilidade(25pts)
const SCORE_PESOS = { momentum: 0.10, rejeicao: 0.20, liquidez: 0.15, volume: 0.30, volatilidade: 0.25 };

function _normalizar_momentum(momentum) {
  if (!momentum || momentum.status === 'sem_dados') return 0;
  if (momentum.status === 'em_formacao_confirmada') return 100;
  if (momentum.status === 'em_formacao') return 50;
  return 0;
}

function _normalizar_rejeicao(rejeicao) {
  if (!rejeicao || !rejeicao.tem_rejeicao) return 0;
  return (rejeicao.forca / 10) * 100;
}

function _normalizar_liquidez(liquidez) {
  if (!liquidez) return 0;
  if (liquidez.tem_liquidez) return 100;
  const min_cost = Math.min(liquidez.cost_to_move_up_usd || 0, liquidez.cost_to_move_down_usd || 0);
  if (min_cost <= 0) return 0;
  return Math.min(100, (min_cost / COST_TO_MOVE_MIN_USD) * 100);
}

function _extrair_metricas_candlestick(candlesticks) {
  if (!candlesticks || candlesticks.length === 0) return { volume_ratio: 0, volatilidade_pct: 0 };
  const por_intervalo = {};
  candlesticks.forEach(c => {
    if (!por_intervalo[c.interval]) por_intervalo[c.interval] = [];
    por_intervalo[c.interval].push(c);
  });
  let total_volume_ratio = 0;
  let total_volatilidade = 0;
  let count = 0;
  for (const candles of Object.values(por_intervalo)) {
    if (candles.length === 0) continue;
    const vela = candles[0]; // mais recente
    const sma = candles.reduce((sum, c) => sum + c.volume, 0) / candles.length;
    const volume_ratio = sma > 0 ? vela.volume / sma : 1;
    const volatilidade_pct = vela.close > 0 ? ((vela.high - vela.low) / vela.close) * 100 : 0;
    total_volume_ratio += volume_ratio;
    total_volatilidade += volatilidade_pct;
    count++;
  }
  return {
    volume_ratio: count > 0 ? total_volume_ratio / count : 0,
    volatilidade_pct: count > 0 ? total_volatilidade / count : 0
  };
}

function _normalizar_volume(volume_ratio) {
  // volume_ratio: 1 = médio, 3+ = excelente para scalping
  if (volume_ratio <= 0) return 0;
  return Math.min(100, (volume_ratio / 3) * 100);
}

function _normalizar_volatilidade(volatilidade_pct) {
  // Faixa ótima para scalping: 1-5%
  if (volatilidade_pct <= 0) return 0;
  if (volatilidade_pct < 1) return volatilidade_pct * 60;
  if (volatilidade_pct <= 5) return 60 + ((volatilidade_pct - 1) / 4) * 40;
  // Acima de 5%: muito volátil, penalizar progressivamente
  return Math.max(0, 100 - (volatilidade_pct - 5) * 10);
}

function _salvar_score_historico(moeda, score) {
  try {
    const historico = JSON.parse(localStorage.getItem(SCORE_HISTORY_KEY) || '[]');
    historico.push({ moeda, score, timestamp: Date.now() });
    if (historico.length > SCORE_HISTORY_MAX) {
      historico.splice(0, historico.length - SCORE_HISTORY_MAX);
    }
    localStorage.setItem(SCORE_HISTORY_KEY, JSON.stringify(historico));
  } catch (e) {
    console.warn('[Score] Falha ao salvar histórico:', e);
  }
}

function calcular_score_combinado(moeda, metricas) {
  const { momentum, rejeicao, liquidez, candlesticks } = metricas || {};

  const n_momentum = _normalizar_momentum(momentum);
  const n_rejeicao = _normalizar_rejeicao(rejeicao);
  const n_liquidez = _normalizar_liquidez(liquidez);
  const { volume_ratio, volatilidade_pct } = _extrair_metricas_candlestick(candlesticks || []);
  const n_volume = _normalizar_volume(volume_ratio);
  const n_volatilidade = _normalizar_volatilidade(volatilidade_pct);

  const score_bruto =
    n_momentum * SCORE_PESOS.momentum +
    n_rejeicao * SCORE_PESOS.rejeicao +
    n_liquidez * SCORE_PESOS.liquidez +
    n_volume * SCORE_PESOS.volume +
    n_volatilidade * SCORE_PESOS.volatilidade;

  const score = Math.min(100, Math.max(0, Math.round(score_bruto)));

  const breakdown = {
    momentum: Math.round(n_momentum * SCORE_PESOS.momentum * 10) / 10,
    rejeicao: Math.round(n_rejeicao * SCORE_PESOS.rejeicao * 10) / 10,
    liquidez: Math.round(n_liquidez * SCORE_PESOS.liquidez * 10) / 10,
    volume: Math.round(n_volume * SCORE_PESOS.volume * 10) / 10,
    volatilidade: Math.round(n_volatilidade * SCORE_PESOS.volatilidade * 10) / 10
  };

  _salvar_score_historico(moeda, score);
  return { score, breakdown };
}

function ordenar_por_score(moedas_com_score) {
  return [...moedas_com_score].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.percentual_24h - a.percentual_24h;
  });
}
// ---- fim US-005 ----

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
