// Разбор текста заявки на долг. Основной путь — LLM (Anthropic Claude) со
// структурированным выводом по zod-схеме; запасной — регулярки с тем же
// контрактом (ParsedRequest), чтобы движок был заменяемым.

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { parsedRequest } from "@/lib/validate";
import { SERVICES, type ParsedRequest } from "@/types";

const SYSTEM_PROMPT = `Ты разбираешь сообщения менеджеров, которые просят выдать им деньги в долг из депо (в USDT).
Извлеки данные из текста сообщения.

Правила:
- Сленг единиц: «тез», «теза», «тезер», «юсдт», «usdt», «tether» — это USDT. Сумма всегда в USDT.
- amount — запрошенная сумма долга. Если в тексте одно однозначное число суммы — заполни amount и продублируй его в amount_candidates.
- Если чисел несколько и непонятно, какое из них сумма — amount: null, все кандидаты в amount_candidates, needs_clarification: true, clarification_field: "amount". Не угадывай.
- manager — имя человека, для которого берут деньги, только если оно явно названо («для Питера» → «Питер»). Иначе null. Это подсказка: настоящий менеджер определяется по автору пересланного сообщения.
- destination — куда просят отправить («на рапиру» → «рапира»). Иначе null.
- repay_source — откуда обещают вернуть («верну с кукойн» → «кукойн»). Иначе null.
- service — ТОЛЬКО точное совпадение с одним из: ${SERVICES.join(", ")}. «Рапира», «кукойн» и прочие площадки сюда НЕ входят — для них service: null.
- confidence: "high", если сумма распознана однозначно, иначе "low".`;

/** Основная точка входа: LLM, при недоступности/ошибке — regex-фолбэк. */
export async function parseLoanRequest(text: string): Promise<ParsedRequest> {
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return await parseWithClaude(text);
    } catch (err) {
      console.error("parseLoanRequest: сбой LLM, переключаюсь на regex:", err);
    }
  }
  return parseWithRegex(text);
}

async function parseWithClaude(text: string): Promise<ParsedRequest> {
  // Таймаут в мс; повторы у SDK свои — одного хватит, дальше спасёт фолбэк.
  const client = new Anthropic({ timeout: 20_000, maxRetries: 1 });
  const response = await client.messages.parse({
    model: process.env.TELEGRAM_PARSE_MODEL ?? "claude-opus-4-8",
    max_tokens: 2048,
    thinking: { type: "adaptive" },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: text }],
    output_config: { format: zodOutputFormat(parsedRequest) },
  });
  if (!response.parsed_output) {
    throw new Error("Telegram-парсер: модель не вернула структурированный ответ");
  }
  return response.parsed_output;
}

/** Запасной разбор без LLM: вытаскивает числа, сервис — по точному вхождению. */
export function parseWithRegex(text: string): ParsedRequest {
  const numbers = [...text.matchAll(/\d[\d\s ]*(?:[.,]\d+)?/g)]
    .map((m) => Number(m[0].replace(/[\s ]/g, "").replace(",", ".")))
    .filter((n) => Number.isFinite(n) && n > 0);
  const candidates = [...new Set(numbers)];
  const lower = text.toLowerCase();
  const service = SERVICES.find((s) => lower.includes(s.toLowerCase())) ?? null;

  const single = candidates.length === 1;
  return {
    amount: single ? candidates[0] : null,
    amount_candidates: candidates,
    manager: null,
    destination: null,
    repay_source: null,
    service,
    needs_clarification: !single,
    clarification_field: single ? null : "amount",
    confidence: "low",
  };
}

/** Разбор суммы из текстового ответа-уточнения («10100 теза» → 10100). */
export function parseAmountReply(text: string): number | null {
  const parsed = parseWithRegex(text);
  return parsed.amount;
}
