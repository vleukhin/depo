// Справочник поддерживаемых сетей: контракты USDT, число знаков токенов,
// обозреватели, имена сетей в API бирж и проверка формата адреса.
//
// Модуль намеренно не тянет ни node:crypto, ни серверные зависимости: его
// импортируют и клиентские компоненты (ячейка адреса, форма записи, таблица).

import type { Chain, EvmChain } from "@/types";

export interface ChainMeta {
  label: string; // название сети в интерфейсе
  native: string; // тикер нативной монеты («газ»)
  usdtContract: string; // контракт USDT в этой сети
  usdtDecimals: number; // знаков у USDT: 6 в TRON и Ethereum, 18 в BSC
  nativeDecimals: number; // знаков у нативной монеты: 6 у TRX, 18 у BNB/ETH
  explorerName: string; // как называется обозреватель (для тайтлов ссылок)
  explorerAddress: string; // префикс ссылки на адрес
  explorerTx: string; // префикс ссылки на транзакцию
  bitgetChain: string; // имя сети в API Bitget (параметр `chain` при выводе)
  evmChainId: number | null; // chainid для EVM-RPC; null — TRON
  noderealNetwork: string | null; // поддомен эндпоинта NodeReal (история переводов); null — TRON
}

export const CHAIN_META: Record<Chain, ChainMeta> = {
  tron: {
    label: "TRON",
    native: "TRX",
    usdtContract: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
    usdtDecimals: 6,
    nativeDecimals: 6,
    explorerName: "Tronscan",
    explorerAddress: "https://tronscan.org/#/address/",
    explorerTx: "https://tronscan.org/#/transaction/",
    bitgetChain: "TRX",
    evmChainId: null,
    noderealNetwork: null,
  },
  bsc: {
    label: "BSC",
    native: "BNB",
    // Binance-Peg BSC-USD — у него, в отличие от остальных USDT, 18 знаков.
    usdtContract: "0x55d398326f99059fF775485246999027B3197955",
    usdtDecimals: 18,
    nativeDecimals: 18,
    explorerName: "BscScan",
    explorerAddress: "https://bscscan.com/address/",
    explorerTx: "https://bscscan.com/tx/",
    bitgetChain: "BEP20",
    evmChainId: 56,
    noderealNetwork: "bsc-mainnet",
  },
  ethereum: {
    label: "Ethereum",
    native: "ETH",
    usdtContract: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    usdtDecimals: 6,
    nativeDecimals: 18,
    explorerName: "Etherscan",
    explorerAddress: "https://etherscan.io/address/",
    explorerTx: "https://etherscan.io/tx/",
    bitgetChain: "ERC20",
    evmChainId: 1,
    noderealNetwork: "eth-mainnet",
  },
};

const TRON_ADDRESS_RE = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

/** Сеть с EVM-совместимым RPC (всё, кроме TRON). */
export function isEvmChain(chain: Chain): chain is EvmChain {
  return chain !== "tron";
}

/** Адрес корректного формата для указанной сети (base58check у TRON, hex20 у EVM). */
export function isChainAddress(chain: Chain, value: string | null | undefined): value is string {
  if (!value) return false;
  const address = value.trim();
  return chain === "tron" ? TRON_ADDRESS_RE.test(address) : EVM_ADDRESS_RE.test(address);
}

/** Ссылка на адрес в обозревателе сети. */
export function explorerAddressUrl(chain: Chain, address: string): string {
  return `${CHAIN_META[chain].explorerAddress}${address.trim()}`;
}

/** Ссылка на транзакцию в обозревателе сети. */
export function explorerTxUrl(chain: Chain, txId: string): string {
  return `${CHAIN_META[chain].explorerTx}${txId.trim()}`;
}
