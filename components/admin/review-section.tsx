import type { SupabaseClient } from "@supabase/supabase-js"
import { ReviewPanel } from "@/components/admin/review-panel"
import { REVIEW_SELECT, type ClientReview } from "@/lib/admin/reviews"

export async function ReviewSection({ supabase, clientId }: { supabase: SupabaseClient; clientId: string }) {
  const { data, error } = await supabase.from("clients").select(REVIEW_SELECT).eq("id", clientId).maybeSingle().returns<ClientReview>()
  if (error) console.error("[admin] review query failed:", error.code)
  if (!data) return null
  return <ReviewPanel client={data} />
}
