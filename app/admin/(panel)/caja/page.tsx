import type { Metadata } from "next"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayExpenses, DayPayments, MethodBreakdown, type CashExpense, type CashPayment } from "@/components/admin/cash-sections"
import { PageHeader, Stat, secondaryButtonClass } from "@/components/admin/ui"
import { requireAdmin } from "@/lib/admin/auth"
import { addDays, formatDate, isValidDate, money, startOfArgentinaDay, todayArgentina } from "@/lib/admin/format"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Caja del día" }

type PaymentRow = {
  id: string
  amount: number
  method: string
  paid_at: string
  services: { wash_type: string; clients: { full_name: string } | null } | null
}

type SearchParams = Promise<{ dia?: string }>

export default async function CashPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const { supabase } = await requireAdmin()
  const today = todayArgentina()
  const day = params.dia && isValidDate(params.dia) && params.dia <= today ? params.dia : today
  const monthStart = `${day.slice(0, 7)}-01`

  const [{ data: payments }, { data: expenses }, { data: monthPayments }, { data: monthExpenses }] = await Promise.all([
    supabase
      .from("payments")
      .select("id, amount, method, paid_at, services(wash_type, clients(full_name))")
      .gte("paid_at", startOfArgentinaDay(day))
      .lt("paid_at", startOfArgentinaDay(addDays(day, 1)))
      .order("paid_at", { ascending: true })
      .returns<PaymentRow[]>(),
    supabase
      .from("expenses")
      .select("id, amount, method, category, description")
      .eq("spent_on", day)
      .order("created_at", { ascending: true })
      .returns<CashExpense[]>(),
    supabase
      .from("payments")
      .select("amount")
      .gte("paid_at", startOfArgentinaDay(monthStart))
      .lt("paid_at", startOfArgentinaDay(addDays(day, 1))),
    supabase.from("expenses").select("amount").gte("spent_on", monthStart).lte("spent_on", day),
  ])

  const income: CashPayment[] = (payments ?? []).map((p) => ({
    id: p.id,
    amount: Number(p.amount),
    method: p.method,
    paid_at: p.paid_at,
    client: p.services?.clients?.full_name ?? "Cliente",
    service: p.services?.wash_type ?? "Servicio",
  }))
  const outflow = expenses ?? []

  const sum = (rows: { amount: number }[] | null) => (rows ?? []).reduce((s, r) => s + Number(r.amount), 0)
  const totalIn = sum(income)
  const totalOut = sum(outflow)
  const monthNet = sum(monthPayments) - sum(monthExpenses)

  const prev = addDays(day, -1)
  const next = addDays(day, 1)

  return (
    <>
      <PageHeader title="Caja del día" description="Cobros y gastos del día, separados por medio de pago." />

      <nav aria-label="Cambiar de día" className="flex items-center justify-between gap-2">
        <Link href={`/admin/caja?dia=${prev}`} className={cn(secondaryButtonClass, "size-11 px-0")} aria-label="Día anterior">
          <ChevronLeft className="size-5" aria-hidden="true" />
        </Link>
        <div className="flex flex-col items-center">
          <span className="font-semibold tabular-nums">{formatDate(`${day}T12:00:00-03:00`)}</span>
          {day === today ? (
            <span className="text-xs text-muted-foreground">Hoy</span>
          ) : (
            <Link href="/admin/caja" className="text-xs text-electric underline-offset-4 hover:underline">
              Ir a hoy
            </Link>
          )}
        </div>
        {next <= today ? (
          <Link href={`/admin/caja?dia=${next}`} className={cn(secondaryButtonClass, "size-11 px-0")} aria-label="Día siguiente">
            <ChevronRight className="size-5" aria-hidden="true" />
          </Link>
        ) : (
          <span className="size-11" aria-hidden="true" />
        )}
      </nav>

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Entró" value={money(totalIn)} hint={`${income.length} cobro${income.length === 1 ? "" : "s"}`} />
        <Stat label="Salió" value={money(totalOut)} hint={`${outflow.length} gasto${outflow.length === 1 ? "" : "s"}`} />
        <Stat label="Ganancia del día" value={money(totalIn - totalOut)} />
        <Stat label="Ganancia del mes" value={money(monthNet)} hint="Hasta este día" />
      </dl>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <MethodBreakdown income={income} expenses={outflow} />
          <DayPayments payments={income} />
        </div>
        <DayExpenses expenses={outflow} day={day} today={today} />
      </div>
    </>
  )
}
