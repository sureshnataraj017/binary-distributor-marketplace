import { CircleAlert, CircleCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { FormField as Field, controlClass as inputClass } from '@/components/molecules/FormField'
import { Button } from '@/components/atoms/Button'
import { Card } from '@/components/atoms/Card'
import { defaultCommissionConfig } from '@/config/commissionConfig'
import { parseDollars } from '@/domain/money'
import { useCommissionPreview, useCreateSale } from '@/hooks/useCreateSale'
import { ApiError } from '@/services/apiClient'
import type { Retailer, Sale } from '@/types'
import { formatCurrency } from '@/utils/currencyFormatter'
import { validateSaleForm, type SaleFormValues } from '@/utils/saleForm'

const { retailerPercentage, distributorPercentage, companyPercentage } =
  defaultCommissionConfig.sale
const SUGGESTED_PRODUCTS = ['Product A', 'Product B', 'Product C', 'Product D']
const EMPTY: SaleFormValues = { product: '', quantity: '1', amount: '' }

function Split({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 text-sm">
      <dt className="text-ink-2">
        {label}
        {note && <span className="ml-1 text-xs">({note})</span>}
      </dt>
      <dd className="font-medium tabular-nums">{formatCurrency(value, { precise: true })}</dd>
    </div>
  )
}

/** Shows how a sale divides up. `sale` values come from the server; the preview's come from the engine. */
function SplitList({
  sale,
}: {
  sale: Pick<
    Sale,
    'retailerCommission' | 'distributorCommission' | 'companyCommission' | 'remainder'
  >
}) {
  return (
    <dl className="divide-y divide-line">
      <Split label="Retailer" note={`${retailerPercentage}%`} value={sale.retailerCommission} />
      <Split
        label="Distributor"
        note={`${distributorPercentage}%`}
        value={sale.distributorCommission}
      />
      <Split
        label="Company downline"
        note={`${companyPercentage}%`}
        value={sale.companyCommission}
      />
      <Split label="Unallocated remainder" value={sale.remainder} />
    </dl>
  )
}

export function RecordSaleForm({ retailer, onClose }: { retailer: Retailer; onClose: () => void }) {
  const [values, setValues] = useState<SaleFormValues>(EMPTY)
  const [submitted, setSubmitted] = useState(false)
  const [recorded, setRecorded] = useState<Sale | null>(null)
  const createSale = useCreateSale()

  const { errors, input } = validateSaleForm(values)
  const shownErrors = submitted ? errors : {}
  const preview = useCommissionPreview(parseDollars(values.amount))

  const set = (field: keyof SaleFormValues) => (value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
    setRecorded(null)
    if (createSale.isError) createSale.reset()
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    setSubmitted(true)
    if (!input) return
    createSale.mutate(
      { retailerId: retailer.id, ...input },
      {
        onSuccess: (sale) => {
          setRecorded(sale)
          setValues(EMPTY)
          setSubmitted(false)
        },
      },
    )
  }

  const serverError =
    createSale.error instanceof ApiError
      ? createSale.error.message
      : createSale.error
        ? 'Something went wrong. Please try again.'
        : null

  return (
    <Card className="mt-4 p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Record a sale</h2>
          <p className="text-xs text-ink-2">
            For {retailer.name}. You enter the sale amount; the server calculates who earns what.
          </p>
        </div>
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>

      <form
        aria-label="Record sale"
        onSubmit={onSubmit}
        noValidate
        className="grid gap-4 md:grid-cols-2"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Product" error={shownErrors.product}>
              <input
                list="product-suggestions"
                value={values.product}
                onChange={(e) => set('product')(e.target.value)}
                placeholder="Product A"
                aria-invalid={!!shownErrors.product}
                className={inputClass}
              />
            </Field>
            <datalist id="product-suggestions">
              {SUGGESTED_PRODUCTS.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>
          <Field label="Quantity" error={shownErrors.quantity}>
            <input
              inputMode="numeric"
              value={values.quantity}
              onChange={(e) => set('quantity')(e.target.value)}
              aria-invalid={!!shownErrors.quantity}
              className={inputClass}
            />
          </Field>
          <Field label="Sale amount (USD)" error={shownErrors.amount}>
            <input
              inputMode="decimal"
              value={values.amount}
              onChange={(e) => set('amount')(e.target.value)}
              placeholder="1,000.00"
              aria-invalid={!!shownErrors.amount}
              className={inputClass}
            />
          </Field>
          <div className="flex items-center gap-2 sm:col-span-2">
            <Button type="submit" variant="primary" disabled={createSale.isPending}>
              {createSale.isPending ? 'Recording…' : 'Record sale'}
            </Button>
          </div>
        </div>

        <div className="rounded-lg bg-hover p-3">
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-2">
            {preview ? 'Preview of the split' : 'The split appears here'}
          </div>
          {preview ? (
            <SplitList
              sale={{
                retailerCommission: preview.retailer,
                distributorCommission: preview.distributor,
                companyCommission: preview.company,
                remainder: preview.remainder,
              }}
            />
          ) : (
            <p className="text-sm text-ink-2">
              Enter an amount to see how it divides between the retailer ({retailerPercentage}%),
              distributor ({distributorPercentage}%), company ({companyPercentage}%) and the
              unallocated remainder.
            </p>
          )}
        </div>
      </form>

      <div aria-live="polite" className="mt-3">
        {serverError && (
          <p
            role="alert"
            className="flex items-center gap-1.5 rounded-lg bg-critical-soft px-3 py-2 text-sm text-critical"
          >
            <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
            {serverError}
          </p>
        )}
        {recorded && (
          <div role="status" className="rounded-lg bg-good-soft px-3 py-2 text-sm">
            <p className="flex items-center gap-1.5 font-medium text-good">
              <CircleCheck aria-hidden="true" className="size-4 shrink-0" />
              Recorded {recorded.id} · {formatCurrency(recorded.amount, { precise: true })}
            </p>
            <p className="text-xs text-ink-2">Confirmed by the server:</p>
            <SplitList sale={recorded} />
          </div>
        )}
      </div>
    </Card>
  )
}
