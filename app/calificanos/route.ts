import { redirect } from "next/navigation"
import { GOOGLE_REVIEW_URL } from "@/lib/admin/reviews"

export function GET() {
  redirect(GOOGLE_REVIEW_URL)
}
