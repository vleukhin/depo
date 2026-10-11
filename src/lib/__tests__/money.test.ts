import { describe, expect, it } from "vitest";
import { baseUnitsToMicro, decimalToMicro, fromMicro, toMicro } from "@/lib/money";

describe("toMicro / fromMicro", () => {
  it("переводит десятичный USDT в целые micro без дрейфа float", () => {
    expect(toMicro(0.1 + 0.2)).toBe(300_000);
    expect(toMicro(1234.56)).toBe(1_234_560_000);
    expect(toMicro("10,5")).toBe(10_500_000);
    expect(toMicro(" 7.000001 ")).toBe(7_000_001);
  });

  it("отклоняет нечисловой ввод", () => {
    expect(() => toMicro("abc")).toThrow("Некорректная сумма");
    expect(() => toMicro(Number.NaN)).toThrow("Некорректная сумма");
  });

  it("fromMicro обратна toMicro", () => {
    expect(fromMicro(toMicro(99.99))).toBe(99.99);
  });
});

describe("decimalToMicro", () => {
  it("точно разбирает строку биржи и отбрасывает знаки после шестого", () => {
    expect(decimalToMicro("123.4567891")).toBe(123_456_789);
    expect(decimalToMicro("5")).toBe(5_000_000);
    expect(decimalToMicro("0.000001")).toBe(1);
    expect(decimalToMicro("7.")).toBe(7_000_000);
  });

  it("отклоняет мусор, отрицательные и слишком большие суммы", () => {
    expect(() => decimalToMicro("-1")).toThrow();
    expect(() => decimalToMicro("1e5")).toThrow();
    expect(() => decimalToMicro("99999999999999999999")).toThrow("пределы точности");
  });
});

describe("baseUnitsToMicro", () => {
  it("масштабирует 18 знаков (BEP-20 USDT, BNB, ETH) до micro", () => {
    expect(baseUnitsToMicro(1_500_000_000_000_000_000n, 18)).toBe(1_500_000);
    expect(baseUnitsToMicro(999_999_999_999n, 18)).toBe(0);
  });

  it("6 знаков (TRC-20/ERC-20 USDT) — уже micro", () => {
    expect(baseUnitsToMicro(42_000_000n, 6)).toBe(42_000_000);
  });

  it("меньше 6 знаков — домножает", () => {
    expect(baseUnitsToMicro(15n, 1)).toBe(1_500_000);
  });

  it("бросает ошибку вне безопасного диапазона Number", () => {
    expect(() => baseUnitsToMicro(10n ** 40n, 18)).toThrow("безопасный диапазон");
  });
});
