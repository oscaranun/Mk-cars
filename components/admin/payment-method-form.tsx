import { updatePaymentMethod } from "@/app/admin/(panel)/crm-actions"
import { ActionForm } from "@/components/admin/action-form"
import { fieldClass, secondaryButtonClass } from "@/components/admin/ui"
import { PAYMENT_METHOD } from "@/lib/admin/labels"
import { cn } from "@/lib/utils"

export function PaymentMethodForm({ paymentId, method }: { paymentId: string; method: string }) {
  return (
    <ActionForm action={updatePaymentMethod} submitLabel="Guardar" submitClassName={cn(secondaryButtonClass, "px-3")} inline>
      <input type="hidden" name="payment_id" value={paymentId} />
      <label htmlFor={`pm-${paymentId}`} className="sr-only">
        Medio de pago
      </label>
      <select id={`pm-${paymentId}`} name="method" defaultValue={method} className={cn(fieldClass, "w-36")}>
        {Object.entries(PAYMENT_METHOD).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </ActionForm>
  )
}
