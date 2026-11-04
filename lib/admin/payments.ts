type QueryResult<T> = { data: T | null; error: { code?: string } | null }

/**
 * Runs a payments query excluding voided rows. Before migration 011 the
 * `voided_at` column does not exist (Postgres 42703), so it retries without the filter.
 */
export async function activePayments<T>(run: (excludeVoided: boolean) => PromiseLike<QueryResult<T>>): Promise<QueryResult<T>> {
  const result = await run(true)
  if (result.error?.code === "42703") return run(false)
  return result
}
