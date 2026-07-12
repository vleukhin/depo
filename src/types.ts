export const SERVICES = ["Lets", "Mate", "N-Obmen", "Currex"] as const;
export type Service = (typeof SERVICES)[number];

// Суммы во всех типах ниже — в десятичных USDT (micro-USDT остаётся внутри БД).
export interface Fund {
  id: number;
  name: string;
  amount: number;
  created_at: string;
  updated_at: string;
}

export interface Placement {
  id: number;
  name: string;
  amount: number;
  place: string | null;
  address: string | null;
  comment: string | null;
  chain_checked_at: string | null; // когда сумма обновлялась из сети TRON, NULL — никогда
  created_at: string;
  updated_at: string;
}

export interface CheckBalancesResult {
  checked: number;
  failed: { id: number; name: string; error: string }[];
  skipped: number; // строки без валидного TRON-адреса
}

export interface Debt {
  id: number;
  manager: string;
  amount: number;
  service: Service | null;
  placement_id: number | null;
  placement_name: string | null; // подтягивается через LEFT JOIN
  source_text: string | null;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface Summary {
  total_funds: number;
  total_placements: number;
  total_debts: number;
  diff: number; // (размещено + долги) − депо: >0 избыток, <0 недостача
  balanced: boolean;
}
