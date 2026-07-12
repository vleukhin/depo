"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import { SectionCard } from "@/components/SectionCard";
import { DeleteButton } from "@/components/DeleteButton";
import { formatUsdt } from "@/lib/format";
import { useDeleteFund, useFunds } from "@/hooks/useFunds";
import type { Fund } from "@/types";
import { FundForm } from "./FundForm";

export function FundsSection() {
  const { data: funds = [], isLoading } = useFunds();
  const del = useDeleteFund();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Fund | undefined>(undefined);

  function openCreate() {
    setEditing(undefined);
    setOpen(true);
  }
  function openEdit(fund: Fund) {
    setEditing(fund);
    setOpen(true);
  }

  return (
    <SectionCard
      id="funds"
      title="Средства"
      description="Из чего состоит депо"
      onAdd={openCreate}
    >
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
              <TableCell className="text-right tabular-nums">{formatUsdt(fund.amount)}</TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Изменить"
                  onClick={() => openEdit(fund)}
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Изменить средство" : "Новое средство"}</DialogTitle>
          </DialogHeader>
          <FundForm fund={editing} onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}
