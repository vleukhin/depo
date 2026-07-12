// Определение менеджера по автору пересланного сообщения: ник форварда
// сопоставляется со справочником managers (колонка telegram).

import { findManagerByTelegram } from "@/lib/repo";
import { forwardDisplayName, forwardUsername, type TgMessage } from "@/lib/telegram/types";

export interface ManagerResolution {
  managerId: number | null;
  managerName: string | null;
  username: string | null; // ник автора форварда (без @), если доступен
  displayName: string | null; // отображаемое имя — подсказка для владельца
}

export async function resolveManager(msg: TgMessage): Promise<ManagerResolution> {
  const username = forwardUsername(msg);
  const displayName = forwardDisplayName(msg);
  if (!username) {
    return { managerId: null, managerName: null, username: null, displayName };
  }
  const manager = await findManagerByTelegram(username);
  return {
    managerId: manager?.id ?? null,
    managerName: manager?.name ?? null,
    username,
    displayName,
  };
}
