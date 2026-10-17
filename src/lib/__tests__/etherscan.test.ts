import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchUsdtTransfers, fetchUsdtTransfersInRange } from "@/lib/etherscan";
import { CHAIN_META } from "@/lib/chains";

// Клиент истории Arbitrum: сеть не трогаем, fetch подменяется ответами Etherscan.

const WALLET = "0x1111111111111111111111111111111111111111";
const OTHER = "0x2222222222222222222222222222222222222222";
const USDT = CHAIN_META.arbitrum.usdtContract;
const FAKE = "0x3333333333333333333333333333333333333333";

function row(i: number, opts: { seconds: number; out?: boolean; contract?: string; value?: string }) {
  return {
    hash: `0x${i.toString(16).padStart(64, "0")}`,
    from: opts.out ? WALLET : OTHER,
    to: opts.out ? OTHER : WALLET,
    value: opts.value ?? "12500000", // 12.5 USDT при 6 знаках
    contractAddress: (opts.contract ?? USDT).toLowerCase(),
    tokenSymbol: "USD₮0",
    timeStamp: String(opts.seconds),
  };
}

const ok = (result: unknown) =>
  new Response(JSON.stringify({ status: "1", message: "OK", result }), { status: 200 });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  process.env.ETHERSCAN_API_KEY = "test-key";
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("etherscan.fetchUsdtTransfers", () => {
  it("запрашивает Arbitrum по контракту USDT и отсеивает чужие токены", async () => {
    fetchMock.mockResolvedValueOnce(
      ok([row(1, { seconds: 1_700_000_000, out: true }), row(2, { seconds: 1_699_999_000, contract: FAKE })]),
    );
    const page = await fetchUsdtTransfers("arbitrum", WALLET, { limit: 2 });

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get("chainid")).toBe("42161");
    expect(url.searchParams.get("contractaddress")).toBe(USDT);
    expect(url.searchParams.get("sort")).toBe("desc");

    expect(page.transfers).toHaveLength(1);
    expect(page.transfers[0]).toMatchObject({
      amount: 12.5,
      direction: "out",
      timestamp: 1_700_000_000_000,
    });
    // Пришло ровно limit строк — есть следующая страница.
    expect(page.next).toBe("2");
  });

  it("пустая выборка — не ошибка, а последняя страница", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: "0", message: "No transactions found", result: [] })),
    );
    const page = await fetchUsdtTransfers("arbitrum", WALLET, { page: "3" });
    expect(page).toEqual({ transfers: [], next: null });
  });

  it("разворачивает ошибку ключа в понятное сообщение", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: "0", message: "NOTOK", result: "Invalid API Key" })),
    );
    await expect(fetchUsdtTransfers("arbitrum", WALLET)).rejects.toThrow(/ETHERSCAN_API_KEY/);
  });

  it("без ключа падает до запроса", async () => {
    delete process.env.ETHERSCAN_API_KEY;
    await expect(fetchUsdtTransfers("arbitrum", WALLET)).rejects.toThrow(/ETHERSCAN_API_KEY/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("etherscan.fetchUsdtTransfersInRange", () => {
  it("читает страницы от свежих к старым и останавливается за окном", async () => {
    const from = 1_000_000 * 1000;
    const to = 1_000_100 * 1000;
    fetchMock
      .mockResolvedValueOnce(ok([row(1, { seconds: 1_000_200 }), row(2, { seconds: 1_000_050 })]))
      .mockResolvedValueOnce(ok([row(3, { seconds: 1_000_010 }), row(4, { seconds: 999_000 })]));

    const res = await fetchUsdtTransfersInRange("arbitrum", WALLET, from, to, { pageLimit: 2 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.truncated).toBe(false);
    expect(res.transfers.map((t) => t.timestamp / 1000)).toEqual([1_000_050, 1_000_010]);
  });

  it("помечает усечение, если упёрлись в потолок страниц", async () => {
    fetchMock.mockImplementation(async () => ok([row(1, { seconds: 1_000_050 })]));
    const res = await fetchUsdtTransfersInRange("arbitrum", WALLET, 0, 2_000_000_000_000, {
      pageLimit: 1,
      maxPages: 2,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.truncated).toBe(true);
  });
});
