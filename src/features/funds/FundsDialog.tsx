"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/DeleteButton";
import { UsdtAmount } from "@/components/UsdtAmount";
import { useDeleteFund, useFunds } from "@/hooks/useFunds";
import type { Fund } from "@/types";
import { FundForm } from "./FundForm";

/** Попап управления составом депо (средствами). Открывается кликом по герой-блоку. */
export function FundsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data: funds = [], isLoading } = useFunds();
  const del = useDeleteFund();
  const [editing, setEditing] = useState<Fund | undefined>(undefined);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setEditing(undefined);
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Средства</DialogTitle>
          <DialogDescription>Из чего состоит депо</DialogDescription>
        </DialogHeader>

        {/* Инлайн-форма add/edit; key перемонтирует её при смене редактируемой строки. */}
        <FundForm
          key={editing?.id ?? "new"}
          fund={editing}
          onDone={() => setEditing(undefined)}
          onCancel={() => setEditing(undefined)}
        />

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              <TableHead className="text-right">Сумма</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {funds.map((fund) => (
              <TableRow key={fund.id}>
                <TableCell className="font-medium">{fund.name}</TableCell>
                <TableCell className="text-right">
                  <UsdtAmount value={fund.amount} />
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Изменить"
                    onClick={() => setEditing(fund)}
                  >
                    <Pencil className="size-4 text-muted-foreground" />
                  </Button>
                  <DeleteButton onConfirm={() => del.mutateAsync(fund.id)} />
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && funds.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                  Пока нет записей
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
}
