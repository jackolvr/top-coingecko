"""
Testes para o script de busca de pares perpétuos USDT da Bybit.
"""

import pytest
from unittest.mock import Mock, patch
from bybit_top_gainers import (
    TabelaPar,
    ClienteCoinGecko,
    FormatadorTabela
)


class TestTabelaPar:
    """Testes para a classe TabelaPar."""

    def test_criar_par_valido(self):
        """Deve criar um par com dados válidos."""
        par = TabelaPar(simbolo="BTC/USDT", preco=45000.5, percentual_24h=2.5)
        assert par.simbolo == "BTC/USDT"
        assert par.preco == 45000.5
        assert par.percentual_24h == 2.5

    def test_preco_negativo_levanta_erro(self):
        """Deve lançar erro para preço negativo."""
        with pytest.raises(ValueError):
            TabelaPar(simbolo="BTC/USDT", preco=-100, percentual_24h=2.5)

    def test_percentual_negativo_valido(self):
        """Deve aceitar percentual negativo (queda de preço)."""
        par = TabelaPar(simbolo="BTC/USDT", preco=45000, percentual_24h=-5.0)
        assert par.percentual_24h == -5.0


class TestClienteCoinGecko:
    """Testes para a classe ClienteCoinGecko."""

    def test_inicializar_cliente(self):
        """Deve inicializar o cliente com timeout padrão."""
        cliente = ClienteCoinGecko()
        assert cliente.timeout == 15

    def test_inicializar_cliente_timeout_customizado(self):
        """Deve inicializar o cliente com timeout customizado."""
        cliente = ClienteCoinGecko(timeout=30)
        assert cliente.timeout == 30

    def test_validar_par_usdt_perpetuo(self):
        """Deve validar par USDT perpétuo corretamente."""
        ticker_valido = {
            "symbol": "BTCUSDT",
            "market": "Bybit (Futures)",
            "contract_type": "perpetual",
            "price_percentage_change_24h": 5.5
        }
        assert ClienteCoinGecko._eh_par_valido(ticker_valido)

    def test_rejeitar_par_nao_usdt(self):
        """Deve rejeitar par que não é USDT."""
        ticker = {
            "symbol": "BTCBUSD",
            "market": "Bybit (Futures)",
            "contract_type": "perpetual",
            "price_percentage_change_24h": 5.5
        }
        assert not ClienteCoinGecko._eh_par_valido(ticker)

    def test_rejeitar_par_nao_perpetuo(self):
        """Deve rejeitar par que não é perpétuo."""
        ticker = {
            "symbol": "BTCUSDT",
            "market": "Bybit (Futures)",
            "contract_type": "futures",
            "price_percentage_change_24h": 5.5
        }
        assert not ClienteCoinGecko._eh_par_valido(ticker)

    def test_rejeitar_par_sem_percentual(self):
        """Deve rejeitar par sem dado de percentual 24h."""
        ticker = {
            "symbol": "BTCUSDT",
            "market": "Bybit (Futures)",
            "contract_type": "perpetual",
            "price_percentage_change_24h": None
        }
        assert not ClienteCoinGecko._eh_par_valido(ticker)

    def test_rejeitar_par_nao_bybit(self):
        """Deve rejeitar par que não é da Bybit."""
        ticker = {
            "symbol": "BTCUSDT",
            "market": "Binance (Futures)",
            "contract_type": "perpetual",
            "price_percentage_change_24h": 5.5
        }
        assert not ClienteCoinGecko._eh_par_valido(ticker)

    def test_filtrar_pares_usdt_perpetuos(self):
        """Deve filtrar corretamente pares USDT perpétuos."""
        tickers = [
            {
                "symbol": "BTCUSDT",
                "market": "Bybit (Futures)",
                "contract_type": "perpetual",
                "price": 45000.5,
                "price_percentage_change_24h": 2.5
            },
            {
                "symbol": "ETHUSDT",
                "market": "Bybit (Futures)",
                "contract_type": "perpetual",
                "price": 2500.0,
                "price_percentage_change_24h": 1.5
            },
            {
                "symbol": "DOGEBUSD",
                "market": "Bybit (Futures)",
                "contract_type": "perpetual",
                "price": 0.08,
                "price_percentage_change_24h": 3.0
            }
        ]

        cliente = ClienteCoinGecko()
        pares_filtrados = cliente._filtrar_usdt_perpetuos(tickers)

        assert len(pares_filtrados) == 2
        assert pares_filtrados[0].simbolo == "BTCUSDT"
        assert pares_filtrados[1].simbolo == "ETHUSDT"

    def test_usar_fallback_preco(self):
        """Deve usar 'price' como fallback se não disponível."""
        tickers = [
            {
                "symbol": "BTCUSDT",
                "market": "Bybit (Futures)",
                "contract_type": "perpetual",
                "price": 45000.0,
                "price_percentage_change_24h": 2.5
            }
        ]

        cliente = ClienteCoinGecko()
        pares_filtrados = cliente._filtrar_usdt_perpetuos(tickers)

        assert len(pares_filtrados) == 1
        assert pares_filtrados[0].preco == 45000.0


class TestFormatadorTabela:
    """Testes para a classe FormatadorTabela."""

    def test_formatar_preco_acima_de_1000(self):
        """Deve formatar preço >= 1000 com 2 casas decimais."""
        resultado = FormatadorTabela.formatar_preco(45000.5678)
        assert "45,000.57" in resultado

    def test_formatar_preco_entre_1_e_1000(self):
        """Deve formatar preço entre 1 e 1000 com 4 casas decimais."""
        resultado = FormatadorTabela.formatar_preco(250.123456)
        assert "250.1235" in resultado

    def test_formatar_preco_abaixo_de_1(self):
        """Deve formatar preço < 1 com 8 casas decimais."""
        resultado = FormatadorTabela.formatar_preco(0.00001234567)
        assert "0.00001235" in resultado

    def test_formatar_zero(self):
        """Deve formatar preço zero corretamente."""
        resultado = FormatadorTabela.formatar_preco(0.0)
        assert "$" in resultado


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
