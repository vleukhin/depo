#!/usr/bin/env node
// Работа с задачей Linear из воркфлоу агентов. Без зависимостей, Node 20+.
// Ключ LINEAR_API_KEY есть только у шагов, которые вызывают этот скрипт, —
// шагу с агентом он не передаётся.
//
//   node linear.mjs claim CRY-12 plan|build     взять задачу: печатает go=true|false
//   node linear.mjs fetch CRY-12 out.md         задача и переписка -> файл
//   node linear.mjs comment CRY-12 body.md      комментарий из файла
//   node linear.mjs say CRY-12 "текст"          короткий комментарий
//   node linear.mjs state CRY-12 questions      перевести в статус (ключ из STATUS)
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

/**
 * Статусы задач Linear, которыми управляется конвейер (без учёта регистра).
 * Первые три совпадают с `STATUS` в мосте agent-bridge (src/core.ts) — меняйте вместе.
 */
export const STATUS = {
  plan: "Planning", // владелец: «спланируй» — триггер
  questions: "Questions", // агент ждёт ответа; комментарий владельца перезапускает план
  build: "Ready for Dev", // владелец: «план согласован» — триггер
  review: "Plan Review", // план готов, ждёт решения владельца
  working: "In Progress", // агент разрабатывает
  pr: "In Review", // PR открыт
};
const same = (a, b) => (a ?? "").trim().toLowerCase() === b.toLowerCase();

/** Маркер комментариев агентов: по нему мост отличает их от ваших (ключ-то один). */
export const BOT_MARKER = "🤖";
const ISSUE_RE = /^[A-Z][A-Z0-9]{0,9}-\d{1,7}$/;
/** Комментарий в Linear из файла агента — данные, а не доверенный текст: режем по длине. */
const MAX_COMMENT = 60_000;

export function assertIssueId(id) {
  if (!ISSUE_RE.test(id ?? "")) throw new Error(`Некорректный идентификатор задачи: ${id}`);
  return id;
}

async function gql(query, variables) {
  const key = process.env.LINEAR_API_KEY;
  if (!key) throw new Error("Не задан секрет LINEAR_API_KEY");
  const res = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: key },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json || json.errors?.length || !json.data) {
    const detail = json?.errors?.map((e) => e.message).join("; ") ?? `HTTP ${res.status}`;
    throw new Error(`Linear API: ${detail}`);
  }
  return json.data;
}

/** Задача и переписка одним markdown-файлом для агента. */
export function renderTask(issue) {
  const out = [`# ${issue.identifier}: ${issue.title}`, "", issue.description?.trim() || "_(описания нет)_"];
  const comments = [...issue.comments.nodes].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const c of comments) {
    const body = c.body ?? "";
    const fromAgent = body.trimStart().startsWith(BOT_MARKER);
    const who = fromAgent ? "АГЕНТ" : `ВЛАДЕЛЕЦ (${c.user?.name ?? "—"})`;
    out.push("", "---", `Комментарий · ${who} · ${c.createdAt}`, "", body.trim());
  }
  return out.join("\n") + "\n";
}

async function getIssue(id) {
  const { issue } = await gql(
    `query($id: String!) {
      issue(id: $id) {
        id identifier title description url
        state { name }
        team { states { nodes { id name } } }
        comments(first: 250) { nodes { body createdAt user { name } } }
      }
    }`,
    { id },
  );
  return issue;
}

async function setState(issue, key) {
  const name = STATUS[key];
  if (!name) throw new Error(`Неизвестный ключ статуса: ${key}`);
  if (same(issue.state?.name, name)) return;
  const target = issue.team.states.nodes.find((st) => same(st.name, name));
  if (!target) throw new Error(`В команде Linear нет статуса «${name}» — создайте его (см. docs/PIPELINE.md)`);
  await gql(`mutation($id: String!, $input: IssueUpdateInput!) { issueUpdate(id: $id, input: $input) { success } }`, {
    id: issue.id,
    input: { stateId: target.id },
  });
}

async function comment(id, text) {
  const issue = await getIssue(id);
  let body = text.trim();
  if (body.length > MAX_COMMENT) body = body.slice(0, MAX_COMMENT) + "\n\n_(обрезано)_";
  await gql(`mutation($input: CommentCreateInput!) { commentCreate(input: $input) { success } }`, {
    input: { issueId: issue.id, body: `${BOT_MARKER} **Агент**\n\n${body}\n` },
  });
}

/**
 * Можно ли начинать этап при текущем статусе задачи и куда её перевести.
 * Разработка сразу уводит задачу из статуса-триггера: повторная доставка вебхука
 * или второй запуск увидят, что её уже взяли, и остановятся.
 */
export function claim(stage, stateName) {
  if (stage === "plan") {
    // Статус не трогаем: смена Questions -> Planning сама была бы новым триггером.
    return { go: same(stateName, STATUS.plan) || same(stateName, STATUS.questions), moveTo: null };
  }
  if (stage === "build") {
    return same(stateName, STATUS.build) ? { go: true, moveTo: "working" } : { go: false, moveTo: null };
  }
  throw new Error(`Неизвестный этап: ${stage}`);
}

async function main([cmd, rawId, arg]) {
  const id = assertIssueId(rawId);
  switch (cmd) {
    case "claim": {
      const issue = await getIssue(id);
      const { go, moveTo } = claim(arg, issue.state?.name);
      if (go && moveTo) await setState(issue, moveTo);
      console.log(`go=${go}`);
      return;
    }
    case "fetch": {
      const issue = await getIssue(id);
      await writeFile(arg, renderTask(issue));
      console.log(`${issue.identifier}: статус «${issue.state?.name ?? "—"}», ${issue.comments.nodes.length} коммент.`);
      return;
    }
    case "comment":
      return comment(id, await readFile(arg, "utf8"));
    case "say":
      return comment(id, arg);
    case "state":
      return setState(await getIssue(id), arg);
    default:
      throw new Error(`Неизвестная команда: ${cmd}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
