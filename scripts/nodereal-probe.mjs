// Зонд ответа NodeReal: печатает сырую строку перевода и то, как её разобрал
// lib/nodereal.ts. Нужен, чтобы сверить форму ответа с живым API — из среды,
// где писался модуль, доступа к nodereal.io не было.
//
//   NODEREAL_API_KEY=<ключ> node scripts/nodereal-probe.mjs bsc 0x<адрес>
//
// Что смотреть в выводе:
//   1. есть ли в строке адрес контракта токена (по нему отбирается именно USDT);
//   2. в каких единицах приходит `value` — базовых (10^18 у BSC-USD) или уже
//      десятичных;
//   3. как выглядит `blockTimeStamp`.
// Если разобранная сумма и время совпали с обозревателем — модуль верен.

const [chain, address] = process.argv.slice(2);

if (!process.env.NODEREAL_API_KEY) {
  console.error("Нужна переменная NODEREAL_API_KEY");
  process.exit(1);
}
if (!["bsc", "ethereum"].includes(chain) || !/^0x[0-9a-fA-F]{40}$/.test(address ?? "")) {
  console.error("Использование: node scripts/nodereal-probe.mjs <bsc|ethereum> <0x-адрес>");
  process.exit(1);
}

const NETWORK = { bsc: "bsc-mainnet", ethereum: "eth-mainnet" }[chain];
const USDT = {
  bsc: "0x55d398326f99059fF775485246999027B3197955",
  ethereum: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
}[chain];

const res = await fetch(`https://${NETWORK}.nodereal.io/v1/${process.env.NODEREAL_API_KEY}`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "nr_getTransactionByAddress",
    params: [{ category: ["20"], address, addressType: null, order: "desc", maxCount: "0x5" }],
  }),
});

console.log("HTTP", res.status);
const json = await res.json();
if (json.error) {
  console.log("Ошибка API:", json.error);
  process.exit(1);
}

const rows = json.result?.transfers ?? [];
console.log("pageKey:", json.result?.pageKey ?? "(нет)");
console.log("строк:", rows.length);
if (rows.length === 0) process.exit(0);

console.log("\n--- сырая первая строка ---");
console.log(JSON.stringify(rows[0], null, 2));

console.log("\n--- как её разберёт lib/nodereal.ts ---");
const { fetchUsdtTransfers } = await import("../src/lib/nodereal.ts");
const page = await fetchUsdtTransfers(chain, address, { limit: 5 });
console.log(`контракт USDT этой сети: ${USDT}`);
console.log(JSON.stringify(page, null, 2));
