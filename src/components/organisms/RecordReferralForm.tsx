import { useId, useMemo, useState, type FormEvent } from 'react'
import { FormField, FormMessage, controlClass } from '@/components/molecules/FormField'
import { Button } from '@/components/atoms/Button'
import { Card } from '@/components/atoms/Card'
import { DatePicker } from '@/components/atoms/DatePicker'
import { Select } from '@/components/atoms/Select'
import { defaultCommissionConfig } from '@/config/commissionConfig'
import { businessDayKey } from '@/domain/dateUtils'
import { parseDollars } from '@/domain/money'
import { useCreateReferral, useReferralPreview } from '@/hooks/useEntryMutations'
import { useNow } from '@/hooks/useNow'
import { ApiError } from '@/services/apiClient'
import type { Distributor, Referral } from '@/types'
import { formatCurrency } from '@/utils/currencyFormatter'
import {
  EMPTY_REFERRAL_FORM,
  validateReferralForm,
  type ReferralFormValues,
} from '@/utils/entryForms'

interface Props {
  distributors: readonly Distributor[]
  onClose: () => void
}

export function RecordReferralForm({ distributors, onClose }: Props) {
  const [values, setValues] = useState<ReferralFormValues>(EMPTY_REFERRAL_FORM)
  const [submitted, setSubmitted] = useState(false)
  const [recorded, setRecorded] = useState<Referral | null>(null)
  const create = useCreateReferral()
  const now = useNow()
  const uid = useId()

  const byId = useMemo(() => new Map(distributors.map((d) => [d.id, d])), [distributors])
  // Only a distributor who was referred by someone can generate a referral commission.
  const referred = useMemo(() => distributors.filter((d) => d.referredBy), [distributors])
  const referrer = byId.get(byId.get(values.referredDistributorId)?.referredBy ?? '')

  const { errors, input } = validateReferralForm(values, now)
  const shown = submitted ? errors : {}
  const commission = useReferralPreview(parseDollars(values.fee))

  const set = (patch: Partial<ReferralFormValues>) => {
    setValues((current) => ({ ...current, ...patch }))
    setRecorded(null)
    if (create.isError) create.reset()
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    setSubmitted(true)
    if (!input) return
    create.mutate(input, {
      onSuccess: (referral) => {
        setRecorded(referral)
        setValues(EMPTY_REFERRAL_FORM)
        setSubmitted(false)
      },
    })
  }

  const serverError =
    create.error instanceof ApiError
      ? create.error.message
      : create.error
        ? 'Something went wrong. Please try again.'
        : null

  return (
    <Card className="mb-4 p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Record a referral fee</h2>
          <p className="text-xs text-ink-2">
            The referring distributor earns {defaultCommissionConfig.referralPercentage}% of the fee
            the referred distributor generates. The server works out who the referrer is and the
            commission.
          </p>
        </div>
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>

      {referred.length === 0 ? (
        <p className="text-sm text-ink-2">
          No distributor has a referrer yet. When you add a distributor, choose who referred them,
          then record their fees here.
        </p>
      ) : (
        <form
          aria-label="Record referral fee"
          onSubmit={onSubmit}
          noValidate
          className="grid gap-3 md:grid-cols-2"
        >
          <FormField
            label="Referred distributor"
            id={`${uid}-referred-distributor`}
            error={shown.referredDistributorId}
            hint={
              referrer
                ? `Referred by ${referrer.name} (${referrer.id}), who earns the commission.`
                : undefined
            }
          >
            <Select
              inputId={`${uid}-referred-distributor`}
              value={values.referredDistributorId}
              onChange={(referredDistributorId) => set({ referredDistributorId })}
              invalid={!!shown.referredDistributorId}
              options={[
                { value: '', label: 'Choose a distributor…' },
                ...referred.map((d) => ({
                  value: d.id,
                  label: `${d.name} (${d.id}) · referred by ${byId.get(d.referredBy!)?.name ?? d.referredBy}`,
                })),
              ]}
            />
          </FormField>
          <FormField
            label="Fee (USD)"
            error={shown.fee}
            hint={
              commission
                ? `Referral commission: ${formatCurrency(commission, { precise: true })}`
                : undefined
            }
          >
            <input
              inputMode="decimal"
              value={values.fee}
              onChange={(e) => set({ fee: e.target.value })}
              placeholder="500"
              aria-invalid={!!shown.fee}
              className={controlClass}
            />
          </FormField>
          <FormField
            label="Date (optional)"
            id={`${uid}-date`}
            error={shown.date}
            hint="Leave empty for today."
          >
            <DatePicker
              id={`${uid}-date`}
              max={businessDayKey(now, defaultCommissionConfig.businessTimeZone)}
              value={values.date}
              onChange={(date) => set({ date })}
              invalid={!!shown.date}
            />
          </FormField>
          <div className="flex items-end">
            <Button type="submit" variant="primary" disabled={create.isPending}>
              {create.isPending ? 'Recording…' : 'Record referral'}
            </Button>
          </div>
        </form>
      )}

      <div aria-live="polite" className="mt-3 space-y-2">
        {serverError && <FormMessage tone="error">{serverError}</FormMessage>}
        {recorded && (
          <FormMessage tone="success">
            Recorded {recorded.id}: {formatCurrency(recorded.commission, { precise: true })}{' '}
            commission for {recorded.referringDistributorId}, pending payment.
          </FormMessage>
        )}
      </div>
    </Card>
  )
}
