"use client";

import { useState } from "react";
import { CalendarIcon, ChevronLeft } from "lucide-react";
import { ru } from "react-day-picker/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DebtForm } from "@/features/debts/DebtForm";
import { useDayTransactions } from "@/hooks/usePlacements";
import { formatDate, toYmd } from "@/lib/format";
import { TransferRow } from "./TransferRow";

type Draft = { amount: number; tx_id: string; placement_id: number };

function yesterday(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d;
}

/** Переводы USDT по всем внешним кошелькам за выбранный день (границы дня — по МСК). */
export function DayTransactionsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [date, setDate] = useState<Date>(() => new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);

  const ymd = toYmd(date);
  const { data, isLoading, isError, error } = useDayTransactions(ymd, open);

  function handleOpenChange(v: boolean) {
    if (!v) setDraft(null);
    onOpenChange(v);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {draft ? (
              <span className="inline-flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 -ml-1"
                  aria-label="Назад к транзакциям"
                  onClick={() => setDraft(null)}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                Новый долг
              </span>
            ) : (
              `Транзакции — ${formatDate(ymd)}`
            )}
          </DialogTitle>
        </DialogHeader>

        {draft ? (
          <DebtForm
            defaults={{
              amount: draft.amount,
              placement_id: draft.placement_id,
              tx_id: draft.tx_id,
            }}
            onDone={() => handleOpenChange(false)}
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-1.5">
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" size="sm" className="font-normal">
                    <CalendarIcon className="size-4 text-muted-foreground" />
                    {formatDate(ymd)}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => {
                      if (d) {
                        setDate(d);
                        setCalendarOpen(false);
                      }
                    }}
                    defaultMonth={date}
                    locale={ru}
                    autoFocus
                  />
                </PopoverContent>
              </Popover>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => setDate(new Date())}
              >
                Сегодня
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => setDate(yesterday())}
              >
                Вчера
              </Button>
            </div>

            {isError && <p className="text-sm text-destructive">{(error as Error).message}</p>}

            {data && data.failed.length > 0 && (
              <p className="text-sm text-destructive">
                Не удалось получить: {data.failed.map((f) => f.name).join(", ")}
              </p>
            )}
            {data?.truncated && (
              <p className="text-sm text-muted-foreground">
                Показаны не все переводы за день — их слишком много.
              </p>
            )}

            {isLoading ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Загрузка транзакций…
              </p>
            ) : data && data.transfers.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Переводов USDT за этот день не найдено.
              </p>
            ) : (
              data && (
                <ul className="-mr-2 max-h-[60vh] divide-y overflow-y-auto pr-2">
                  {data.transfers.map((t) => (
                    <TransferRow
                      key={`${t.placement_id}:${t.tx_id}:${t.from}:${t.to}:${t.amount}`}
                      transfer={t}
                      walletName={t.placement_name}
                      showDate={false}
                      onCreateDebt={() =>
                        setDraft({
                          amount: t.amount,
                          tx_id: t.tx_id,
                          placement_id: t.placement_id,
                        })
                      }
                    />
                  ))}
                </ul>
              )
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
