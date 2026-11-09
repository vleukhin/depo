import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchCoinBalanceMicro } from "@/lib/bybit";

// Клиент Bybit v5: сеть не трогаем, fetch подменяется ответами биржи.

const ok = (result: unknown) =>
  new Response(JSON.stringify({ retCode: 0, retMsg: "OK", result, retExtInfo: {}, time: 1 }), {
    status: 200,
  });

const fail = (retCode: number, retMsg: string) =>
  new Response(JSON.stringify({ retCode, retMsg, result: {}, retExtInfo: {}, time: 1 }), {
    status: 200,
  });

const unified = (coins: Record<string, string>[]) => ok({ list: [{ accountType: "UNIFIED", coin: coins }] });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  process.env.BYBIT_API_KEY = "test-key";
  process.env.BYBIT_API_SECRET = "test-secret";
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("bybit.fetchCoinBalanceMicro", () => {
  it("spot: подписывает запрос к UTA и вычитает locked и spotBorrow", async () => {
    fetchMock.mockResolvedValueOnce(
      unified([{ coin: "USDT", walletBalance: "1250.5", locked: "200.25", spotBorrow: "50" }]),
    );
    expect(await fetchCoinBalanceMicro("USDT", "spot")).toBe(1_000_250_000);

    const [rawUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const url = new URL(rawUrl);
    expect(url.origin + url.pathname).toBe("https://api.bybit.com/v5/account/wallet-balance");
    expect(url.search).toBe("?accountType=UNIFIED&coin=USDT");

    const h = init.headers as Record<string, string>;
    expect(h["X-BAPI-API-KEY"]).toBe("test-key");
    const expected = createHmac("sha256", "test-secret")
      .update(h["X-BAPI-TIMESTAMP"] + "test-key" + h["X-BAPI-RECV-WINDOW"] + "accountType=UNIFIED&coin=USDT")
      .digest("hex");
    expect(h["X-BAPI-SIGN"]).toBe(expected);
  });

  it("spot: пустые поля и отсутствие монеты дают 0", async () => {
    fetchMock.mockResolvedValueOnce(unified([{ coin: "TRX", walletBalance: "", locked: "" }]));
    expect(await fetchCoinBalanceMicro("TRX", "spot")).toBe(0);
    fetchMock.mockResolvedValueOnce(ok({ list: [] }));
    expect(await fetchCoinBalanceMicro("TRX", "spot")).toBe(0);
  });

  it("main: читает Funding и берёт walletBalance, а не transferBalance", async () => {
    fetchMock.mockResolvedValueOnce(
      ok({
        memberId: "1",
        accountType: "FUND",
        balance: [{ coin: "USDT", walletBalance: "300.123456789", transferBalance: "100", bonus: "" }],
      }),
    );
    expect(await fetchCoinBalanceMicro("USDT", "main")).toBe(300_123_456);

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.pathname).toBe("/v5/asset/transfer/query-account-coins-balance");
    expect(url.searchParams.get("accountType")).toBe("FUND");
    expect(url.searchParams.get("coin")).toBe("USDT");
  });

  it("прикладная ошибка из retCode превращается в исключение с сообщением биржи", async () => {
    fetchMock.mockResolvedValueOnce(fail(10003, "API key is invalid."));
    await expect(fetchCoinBalanceMicro("USDT", "main")).rejects.toThrow("Bybit: API key is invalid.");
  });

  it("HTTP-ошибка без JSON (403 с IP из США) — понятная ошибка со статусом", async () => {
    fetchMock.mockResolvedValueOnce(new Response("<html>403</html>", { status: 403 }));
    await expect(fetchCoinBalanceMicro("USDT", "spot")).rejects.toThrow("Bybit: HTTP 403");
  });

  it("повторяет запрос при rate limit (retCode 10006 и HTTP 429)", async () => {
    vi.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce(fail(10006, "Too many visits!"))
      .mockResolvedValueOnce(new Response("", { status: 429 }))
      .mockResolvedValueOnce(unified([{ coin: "USDT", walletBalance: "5", locked: "0" }]));
    const promise = fetchCoinBalanceMicro("USDT", "spot");
    await vi.runAllTimersAsync();
    expect(await promise).toBe(5_000_000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("без ключей — ошибка про переменные окружения, запрос не уходит", async () => {
    delete process.env.BYBIT_API_KEY;
    await expect(fetchCoinBalanceMicro("USDT", "spot")).rejects.toThrow(
      "Не заданы переменные BYBIT_API_KEY / BYBIT_API_SECRET",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
