import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Client } from "@libsql/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Журнал изменений состава депо: проверяем на настоящем SQLite-файле, что каждая
// правка средств оставляет ровно одну запись с прежними значениями и итогом.

type Repo = typeof import("@/lib/repo");

let dir: string;
let db: Client;
let repo: Repo;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "depo-fund-history-"));
  delete process.env.TURSO_DATABASE_URL;
  process.env.DB_PATH = join(dir, "depo.db");
  // getClient() мемоизирован на globalThis — сбрасываем, чтобы открыть свою БД.
  delete (globalThis as { __depoClient?: unknown }).__depoClient;
  repo = await import("@/lib/repo");
  const { getClient } = await import("@/lib/db");
  db = await getClient();
});

afterAll(() => {
  db?.close();
  rmSync(dir, { recursive: true, force: true });
});

/** Вся история от старых к новым. */
async function history() {
  const page = await repo.listFundHistory(1);
  return [...page.items].reverse();
}

describe("история состава депо", () => {
  let alice: number;
  let bob: number;

  it("пишет создание с полной суммой и итогом", async () => {
    alice = (await repo.createFund({ name: "Алиса", amount: 1000.5 })).id;
    bob = (await repo.createFund({ name: "Боб", amount: 250 })).id;
    const h = await history();
    expect(h).toHaveLength(2);
    expect(h[0]).toMatchObject({
      fund_id: alice,
      action: "create",
      name: "Алиса",
      prev_name: null,
      amount: 1000.5,
      prev_amount: null,
      delta: 1000.5,
      total_after: 1000.5,
    });
    expect(h[1]).toMatchObject({ fund_id: bob, action: "create", delta: 250, total_after: 1250.5 });
  });

  it("пишет изменение суммы: было, стало, разница, итог", async () => {
    await repo.updateFund(alice, { name: "Алиса", amount: 800.25 });
    const last = (await history()).at(-1);
    expect(last).toMatchObject({
      fund_id: alice,
      action: "update",
      name: "Алиса",
      prev_name: null,
      amount: 800.25,
      prev_amount: 1000.5,
      delta: -200.25,
      total_after: 1050.25,
    });
  });

  it("пишет переименование с прежним названием", async () => {
    await repo.updateFund(bob, { name: "Борис", amount: 250 });
    const last = (await history()).at(-1);
    expect(last).toMatchObject({
      fund_id: bob,
      action: "update",
      name: "Борис",
      prev_name: "Боб",
      amount: 250,
      prev_amount: 250,
      delta: 0,
      total_after: 1050.25,
    });
  });

  it("не пишет пустую правку и правку несуществующего средства", async () => {
    const before = (await history()).length;
    expect(await repo.updateFund(alice, { name: "Алиса", amount: 800.25 })).not.toBeNull();
    expect(await repo.updateFund(9999, { name: "Нет", amount: 1 })).toBeNull();
    expect(await repo.deleteFund(9999)).toBe(false);
    expect(await history()).toHaveLength(before);
  });

  it("пишет удаление и переживает его", async () => {
    expect(await repo.deleteFund(bob)).toBe(true);
    const last = (await history()).at(-1);
    expect(last).toMatchObject({
      fund_id: bob,
      action: "delete",
      name: "Борис",
      amount: 0,
      prev_amount: 250,
      delta: -250,
      total_after: 800.25,
    });
    // Итог последней записи совпадает с суммой средств в депо.
    const funds = await repo.listFunds();
    expect(funds.reduce((s, f) => s + f.amount, 0)).toBe(last?.total_after);
  });

  it("отдаёт историю постранично, новые сверху", async () => {
    for (let i = 1; i <= 20; i++) await repo.updateFund(alice, { name: "Алиса", amount: i });
    const p1 = await repo.listFundHistory(1);
    const p2 = await repo.listFundHistory(2);
    expect(p1.total).toBe(25);
    expect(p1.items).toHaveLength(20);
    expect(p1.items[0].amount).toBe(20);
    expect(p2.items).toHaveLength(5);
    expect(p2.items.at(-1)?.action).toBe("create");
  });
});
