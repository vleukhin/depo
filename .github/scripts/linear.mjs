#!/usr/bin/env node
// Работа с задачей Linear из воркфлоу агентов. Без зависимостей, Node 20+.
// Ключ LINEAR_API_KEY есть только у шагов, которые вызывают этот скрипт, —
// шагу с агентом он не передаётся.
//
//   node linear.mjs claim CRY-12 plan|build     взять задачу: печатает go=true|false
//   node linear.mjs fetch CRY-12 out.md         задача и переписка -> файл
//   node linear.mjs comment CRY-12 body.md      комментарий из файла
//   node linear.mjs say CRY-12 "текст"          короткий комментарий
//   node linear.mjs label-add CRY-12 имя
//   node linear.mjs label-remove CRY-12 имя
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

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
        labels { nodes { id name } }
        comments(first: 250) { nodes { body createdAt user { name } } }
      }
    }`,
    { id },
  );
  return issue;
}

async function labelId(name) {
  const { issueLabels } = await gql(`query { issueLabels(first: 250) { nodes { id name } } }`, {});
  return issueLabels.nodes.find((l) => l.name.toLowerCase() === name.toLowerCase())?.id ?? null;
}

async function removeLabel(issue, name) {
  const has = issue.labels.nodes.find((l) => l.name.toLowerCase() === name.toLowerCase());
  if (!has) return false;
  await gql(`mutation($id: String!, $labelId: String!) { issueRemoveLabel(id: $id, labelId: $labelId) { success } }`, {
    id: issue.id,
    labelId: has.id,
  });
  return true;
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
 * Какие метки дают право начать этап. Метка-триггер снимается здесь же: повторная
 * доставка вебхука или второй запуск увидят, что задачу уже взяли, и остановятся.
 */
export function claimPlan(labelNames) {
  const has = new Set(labelNames.map((l) => l.toLowerCase()));
  if (has.has("agent:plan")) return { go: true, remove: ["agent:plan"] };
  if (has.has("agent:questions")) return { go: true, remove: [] };
  return { go: false, remove: [] };
}
export function claimBuild(labelNames) {
  const has = new Set(labelNames.map((l) => l.toLowerCase()));
  if (!has.has("agent:build")) return { go: false, remove: [] };
  // Вопросы больше не ждут ответа: иначе любой комментарий перезапускал бы планирование.
  return { go: true, remove: ["agent:build", "agent:questions"] };
}

async function main([cmd, rawId, arg]) {
  const id = assertIssueId(rawId);
  switch (cmd) {
    case "claim": {
      if (arg !== "plan" && arg !== "build") throw new Error(`Неизвестный этап: ${arg}`);
      const issue = await getIssue(id);
      const names = issue.labels.nodes.map((l) => l.name);
      const { go, remove } = arg === "plan" ? claimPlan(names) : claimBuild(names);
      for (const name of remove) await removeLabel(issue, name);
      console.log(`go=${go}`);
      return;
    }
    case "fetch": {
      const issue = await getIssue(id);
      await writeFile(arg, renderTask(issue));
      console.log(`${issue.identifier}: ${issue.comments.nodes.length} коммент., метки: ${issue.labels.nodes.map((l) => l.name).join(", ") || "—"}`);
      return;
    }
    case "comment":
      return comment(id, await readFile(arg, "utf8"));
    case "say":
      return comment(id, arg);
    case "label-add":
    case "label-remove": {
      const issue = await getIssue(id);
      const has = issue.labels.nodes.find((l) => l.name.toLowerCase() === arg.toLowerCase());
      if (cmd === "label-remove") {
        await removeLabel(issue, arg);
        return;
      }
      if (has) return;
      const lid = await labelId(arg);
      if (!lid) throw new Error(`В Linear нет метки «${arg}»`);
      await gql(`mutation($id: String!, $labelId: String!) { issueAddLabel(id: $id, labelId: $labelId) { success } }`, {
        id: issue.id,
        labelId: lid,
      });
      return;
    }
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
