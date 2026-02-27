#!/usr/bin/env python3
"""
Script para buscar os 20 pares perpétuos USDT com maior valorização em 24h na Bybit.
Consome a API aberta da CoinGecko.
"""

import sys
from dataclasses import dataclass
from typing import Optional

import requests


@dataclass
class TabelaPar:
    """Representa um par de trading com seus dados."""
    simbolo: str
    preco: float
    percentual_24h: float

    def __post_init__(self) -> None:
        """Valida os dados do par."""
        if self.preco < 0:
            raise ValueError(f"Preço não pode ser negativo: {self.preco}")


class ClienteCoinGecko:
    """Cliente para interagir com a API CoinGecko."""

    URL_BASE = "https://api.coingecko.com/api/v3"
    TIMEOUT = 15
    PARES_POR_PAGINA = 100

    def __init__(self, timeout: int = TIMEOUT) -> None:
        """Inicializa o cliente."""
        self.timeout = timeout
        self.sessao = requests.Session()

    def obter_pares_bybit(self) -> list[TabelaPar]:
        """
        Obtém os pares perpétuos USDT da Bybit ordenados por maior valorização 24h.

        Retorna:
            Lista de TabelaPar com os pares encontrados.

        Levanta:
            SystemExit: Se houver erro na requisição.
        """
        print("Buscando dados de derivativos da Bybit na CoinGecko...\n")

        try:
            todos_pares = self._buscar_todos_tickers()
            pares_filtrados = self._filtrar_usdt_perpetuos(todos_pares)
            pares_ordenados = sorted(
                pares_filtrados,
                key=lambda p: p.percentual_24h,
                reverse=True
            )

            return pares_ordenados[:20]

        except requests.RequestException as erro:
            self._tratar_erro_requisicao(erro)
        except Exception as erro:
            print(f"Erro inesperado: {erro}")
            sys.exit(1)

    def _buscar_todos_tickers(self) -> list[dict]:
        """Busca todos os tickers de derivativos."""
        resposta = self._fazer_requisicao_tickers()
        
        # /derivatives retorna uma lista diretamente, não um dict com 'tickers'
        if isinstance(resposta, list):
            return resposta
        return []

    def _fazer_requisicao_tickers(self) -> list | dict:
        """Faz requisição para obter tickers de derivativos."""
        url = f"{self.URL_BASE}/derivatives"
        parametros = {
            "include_tickers": "perpetual",
            "order": "name",
            "per_page": self.PARES_POR_PAGINA,
            "page": 1
        }
        cabecalhos = {"accept": "application/json"}

        resposta = self.sessao.get(
            url,
            params=parametros,
            headers=cabecalhos,
            timeout=self.timeout
        )

        if resposta.status_code == 429:
            print("⚠️  Limite de requisições da API CoinGecko atingido.")
            print("   Aguarde alguns minutos e tente novamente.")
            sys.exit(1)

        resposta.raise_for_status()
        return resposta.json()

    def _filtrar_usdt_perpetuos(
        self,
        tickers: list[dict]
    ) -> list[TabelaPar]:
        """Filtra apenas pares USDT perpétuos da Bybit com dados válidos."""
        pares_filtrados = []

        for ticker in tickers:
            try:
                if not self._eh_par_valido(ticker):
                    continue

                par = TabelaPar(
                    simbolo=ticker.get("symbol", "N/A"),
                    preco=float(ticker.get("price") or ticker.get("last", 0)),
                    percentual_24h=float(
                        ticker.get("price_percentage_change_24h", 0)
                    )
                )
                pares_filtrados.append(par)

            except (ValueError, TypeError):
                continue

        return pares_filtrados

    @staticmethod
    def _eh_par_valido(ticker: dict) -> bool:
        """Verifica se o ticker é um par USDT perpétuo válido da Bybit."""
        market = str(ticker.get("market", "")).lower()
        symbol = str(ticker.get("symbol", ""))
        
        # Extrair moeda do symbol (ex: "BTCUSDT" -> "USDT")
        eh_usdt = symbol.endswith("USDT")
        
        return (
            "bybit" in market
            and eh_usdt
            and ticker.get("contract_type", "").lower() == "perpetual"
            and ticker.get("price_percentage_change_24h") is not None
        )

    @staticmethod
    def _tratar_erro_requisicao(erro: requests.RequestException) -> None:
        """Trata erros de requisição HTTP."""
        if isinstance(erro, requests.Timeout):
            print("❌ Timeout: A requisição demorou muito. Tente novamente.")
        elif isinstance(erro, requests.ConnectionError):
            print("❌ Erro de conexão: Verifique sua internet.")
        else:
            print(f"❌ Erro na requisição: {erro}")

        sys.exit(1)


class FormatadorTabela:
    """Formata e exibe dados em tabela."""

    LARGURA_MINIMA_PRECO = 16

    @staticmethod
    def formatar_preco(preco: float) -> str:
        """Formata o preço com precisão adequada."""
        if preco >= 1000:
            return f"${preco:>12,.2f}"
        elif preco >= 1:
            return f"${preco:>12,.4f}"
        else:
            return f"${preco:>12,.8f}"

    @classmethod
    def exibir_tabela(cls, pares: list[TabelaPar]) -> None:
        """Exibe os pares em formato de tabela."""
        if not pares:
            print("Nenhum par USDT perpétuo encontrado.")
            return

        # Calcula larguras das colunas
        cabecalho_par = "Par"
        cabecalho_preco = "Preço (USD)"
        cabecalho_mudanca = "Mudança 24h %"

        larg_col1 = max(
            len(cabecalho_par),
            max(len(p.simbolo) for p in pares)
        ) + 2

        larg_col2 = max(
            len(cabecalho_preco),
            cls.LARGURA_MINIMA_PRECO
        ) + 2

        larg_col3 = max(
            len(cabecalho_mudanca),
            10
        ) + 2

        # Desenha tabela
        separador = (
            f"+-{'-' * (larg_col1 - 2)}-+-{'-' * (larg_col2 - 2)}-"
            f"+-{'-' * (larg_col3 - 2)}-+"
        )
        formato_linha = (
            f"| {{:<{larg_col1 - 2}}} | {{:>{larg_col2 - 2}}} | "
            f"{{:>{larg_col3 - 2}}} |"
        )

        print(separador)
        print(formato_linha.format(
            cabecalho_par,
            cabecalho_preco,
            cabecalho_mudanca
        ))
        print(separador)

        for par in pares:
            preco_str = cls.formatar_preco(par.preco).strip()
            mudanca_str = f"{par.percentual_24h:+.2f}%"
            print(formato_linha.format(
                par.simbolo,
                preco_str,
                mudanca_str
            ))

        print(separador)
        print(f"\n✓ Total: {len(pares)} pares USDT perpétuos encontrados")


def main() -> None:
    """Função principal."""
    cliente = ClienteCoinGecko()
    pares = cliente.obter_pares_bybit()

    print("\n╔═══════════════════════════════════════════════════════════╗")
    print("║ TOP 20 PARES PERPETUOS USDT — BYBIT                      ║")
    print("║ Maiores Valorizações em 24 horas                         ║")
    print("╚═══════════════════════════════════════════════════════════╝\n")

    FormatadorTabela.exibir_tabela(pares)


if __name__ == "__main__":
    main()
