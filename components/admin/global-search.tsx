"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"
import { searchPanel, type SearchHit } from "@/app/admin/(panel)/pro-actions"

export function GlobalSearch() {
  const router = useRouter()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState("")
  const [hits, setHits] = useState<SearchHit[]>([])
  const [active, setActive] = useState(0)
  const [pending, startTransition] = useTransition()

  const open = () => {
    dialogRef.current?.showModal()
    inputRef.current?.focus()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        open()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  useEffect(() => {
    if (query.trim().length < 2) return
    const timer = setTimeout(() => {
      startTransition(async () => {
        setHits(await searchPanel(query))
        setActive(0)
      })
    }, 250)
    return () => clearTimeout(timer)
  }, [query])

  const go = (hit: SearchHit) => {
    dialogRef.current?.close()
    setQuery("")
    setHits([])
    router.push(hit.href)
  }

  const visible = query.trim().length < 2 ? [] : hits

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <Search className="size-4" aria-hidden="true" />
        <span className="flex-1 text-left">Buscar</span>
        <kbd className="hidden rounded border border-border px-1.5 text-xs lg:inline">Ctrl K</kbd>
      </button>

      <dialog
        ref={dialogRef}
        aria-label="Buscar en el panel"
        className="m-auto mt-[10vh] w-[min(92vw,32rem)] rounded-2xl border border-border bg-card p-0 text-foreground backdrop:bg-black/60"
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current?.close()
        }}
      >
        <div className="flex items-center gap-2 border-b border-border px-4">
          <Search className="size-4 text-muted-foreground" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing || e.keyCode === 229) return
              if (e.key === "ArrowDown") {
                e.preventDefault()
                setActive((i) => Math.min(i + 1, visible.length - 1))
              } else if (e.key === "ArrowUp") {
                e.preventDefault()
                setActive((i) => Math.max(i - 1, 0))
              } else if (e.key === "Enter" && visible[active]) {
                e.preventDefault()
                go(visible[active])
              }
            }}
            placeholder="Nombre, WhatsApp o patente"
            aria-label="Nombre, WhatsApp o patente"
            className="min-h-12 flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        <ul role="listbox" aria-label="Resultados" className="max-h-80 overflow-y-auto p-2">
          {query.trim().length >= 2 && !pending && visible.length === 0 && (
            <li className="px-3 py-4 text-sm text-muted-foreground">Sin resultados.</li>
          )}
          {pending && <li className="px-3 py-4 text-sm text-muted-foreground">Buscando…</li>}
          {visible.map((hit, i) => (
            <li key={`${hit.href}-${i}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                onClick={() => go(hit)}
                onMouseEnter={() => setActive(i)}
                className={`flex w-full flex-col rounded-lg px-3 py-2 text-left ${i === active ? "bg-muted" : ""}`}
              >
                <span className="text-sm font-medium">{hit.title}</span>
                <span className="text-xs text-muted-foreground">{hit.subtitle}</span>
              </button>
            </li>
          ))}
        </ul>
      </dialog>
    </>
  )
}
