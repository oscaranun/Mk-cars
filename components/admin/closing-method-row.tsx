"use client"

import { useState } from "react"
import { fieldClass } from "@/components/admin/ui"
import { parseMoney } from "@/lib/admin/money"
import { money } from "@/lib/admin/format"

export function ClosingMethodRow({
  method,
  label,
  income,
  expenses,
  opening = 0,
  counted,
}: {
  method: string
  label: string
  income: number
  expenses: number
  opening?: number
  counted?: number
}) {
  const [initial, setInitial] = useState(String(opening))
  const [actual, setActual] = useState(counted === undefined ? "" : String(counted))
  const initialValue = parseMoney(initial)
  const actualValue = parseMoney(actual)
  const expected = initialValue === null ? null : Math.round((initialValue + income - expenses) * 100) / 100
  return (
    <tr>
      <th scope="row" className="py-2 text-left font-medium">
        {label}
      </th>
      <td className="py-2 pl-2">
        <label className="sr-only" htmlFor={`opening_${method}`}>
          Saldo inicial en {label}
        </label>
        <input
          id={`opening_${method}`}
          name={`opening_${method}`}
          inputMode="decimal"
          required
          value={initial}
          onChange={(event) => setInitial(event.target.value)}
          className={`${fieldClass} w-32`}
        />
      </td>
      <td className="py-2 text-right tabular-nums">{money(income)}</td>
      <td className="py-2 text-right tabular-nums">{money(expenses)}</td>
      <td className="py-2 text-right font-semibold tabular-nums">
        {expected === null ? "Revisá el inicial" : money(expected)}
      </td>
      <td className="py-2 pl-4">
        <label className="sr-only" htmlFor={`counted_${method}`}>
          Contado en {label}
        </label>
        <input
          id={`counted_${method}`}
          name={`counted_${method}`}
          inputMode="decimal"
          required
          placeholder="Ingresá lo contado"
          value={actual}
          onChange={(event) => setActual(event.target.value)}
          className={`${fieldClass} w-32`}
        />
        {expected !== null && actualValue !== null && (
          <p className="mt-1 text-xs tabular-nums text-muted-foreground">
            Diferencia: {money(Math.round((actualValue - expected) * 100) / 100)}
          </p>
        )}
      </td>
    </tr>
  )
}
