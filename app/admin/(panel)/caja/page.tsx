import { QueryErrorNotice } from "@/components/admin/query-error-notice"
import type { Metadata } from "next"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayExpenses, ExpenseHistory, type CashExpense } from "@/components/admin/cash-sections"
import { PageHeader, Stat, secondaryButtonClass } from "@/components/admin/ui"
import { requireAdmin } from "@/lib/admin/auth"
import { addDays, formatDate, isValidDate, money, todayArgentina } from "@/lib/admin/format"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Egresos" }

type SearchParams = Promise<{ dia?: string }>

export default async function CashPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const { supabase } = await requireAdmin()
  const today = todayArgentina()
  const day = params.dia && isValidDate(params.dia) && params.dia <= today ? params.dia : today
  const monthStart = `${day.slice(0, 7)}-01`

  const [{data:expenses,error:expensesError},{data:monthExpenses,error:monthExpensesError},{data:recentExpenses,error:recentExpensesError}] = await Promise.all([
    supabase
      .from("expenses")
      .select("id, amount, method, category, description").is("voided_at", null)
      .eq("spent_on", day)
      .order("created_at", { ascending: true })
      .returns<CashExpense[]>(),
    supabase.from("expenses").select("amount").is("voided_at", null).gte("spent_on", monthStart).lte("spent_on", day),
    supabase
      .from("expenses")
      .select("id, amount, method, category, description, spent_on").is("voided_at", null)
      .gte("spent_on", addDays(today, -29))
      .order("spent_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100)
      .returns<(CashExpense & { spent_on: string })[]>(),
  ])

  if (expensesError || monthExpensesError || recentExpensesError) return <QueryErrorNotice subject="los movimientos del día" />

  const outflow = expenses ?? []

  const sum = (rows: { amount: number }[] | null) => (rows ?? []).reduce((s, r) => s + Number(r.amount), 0)
  const totalOut = sum(outflow)

  const prev = addDays(day, -1)
  const next = addDays(day, 1)

  return (
    <>
      <PageHeader title="Egresos" description="Registrá gastos con la fecha real de pago. Los registros anulados no se suman." actions={<Link href="/admin/gastos-fijos" className={secondaryButtonClass}>Gastos fijos</Link>} />

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

      <dl className="grid grid-cols-2 gap-3"><Stat label="Gastos del día" value={money(totalOut)} /><Stat label="Gastos del mes" value={money(sum(monthExpenses))} hint="Hasta el día seleccionado" /></dl>
      <DayExpenses expenses={outflow} day={day} today={today} />

      <ExpenseHistory expenses={recentExpenses ?? []} />
    </>
  )
}
