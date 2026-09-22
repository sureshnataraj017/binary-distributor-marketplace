import { useId, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { FormField, FormMessage, controlClass } from '@/components/molecules/FormField'
import { Button } from '@/components/atoms/Button'
import { Card } from '@/components/atoms/Card'
import { DatePicker } from '@/components/atoms/DatePicker'
import { Select } from '@/components/atoms/Select'
import { defaultCommissionConfig } from '@/config/commissionConfig'
import { INDIA_STATES } from '@/config/indiaStates'
import { businessDayKey } from '@/domain/dateUtils'
import { useCreateRetailer } from '@/hooks/useEntryMutations'
import { useNow } from '@/hooks/useNow'
import { ApiError } from '@/services/apiClient'
import type { Distributor, Retailer } from '@/types'
import {
  EMPTY_RETAILER_FORM,
  validateRetailerForm,
  type RetailerFormValues,
} from '@/utils/entryForms'

interface Props {
  distributors: readonly Distributor[]
  /** Pre-select the distributor (e.g. when opened from that distributor's page). */
  distributorId?: string
  onClose: () => void
}

export function AddRetailerForm({ distributors, distributorId = '', onClose }: Props) {
  const initial = (id: string): RetailerFormValues => {
    const d = distributors.find((x) => x.id === id)
    return { ...EMPTY_RETAILER_FORM, distributorId: id, state: d?.state ?? '', city: d?.city ?? '' }
  }
  const [values, setValues] = useState<RetailerFormValues>(() => initial(distributorId))
  const [submitted, setSubmitted] = useState(false)
  const [added, setAdded] = useState<Retailer | null>(null)
  const create = useCreateRetailer()
  const now = useNow()
  const uid = useId()

  const { errors, input } = validateRetailerForm(values, now)
  const shown = submitted ? errors : {}

  const set = (patch: Partial<RetailerFormValues>) => {
    setValues((current) => ({ ...current, ...patch }))
    setAdded(null)
    if (create.isError) create.reset()
  }

  // A retailer usually operates where its distributor does, so start from that and let it be changed.
  const chooseDistributor = (id: string) => {
    const d = distributors.find((x) => x.id === id)
    set({ distributorId: id, ...(d ? { state: d.state, city: values.city || d.city } : {}) })
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    setSubmitted(true)
    if (!input) return
    create.mutate(input, {
      onSuccess: (retailer) => {
        setAdded(retailer)
        // Keep the distributor selected: people usually add several retailers for one distributor in a row.
        setValues(initial(retailer.distributorId))
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
          <h2 className="font-semibold">Onboard a retailer</h2>
          <p className="text-xs text-ink-2">
            New retailers start active. Each qualifying onboarding earns the distributor a bonus.
          </p>
        </div>
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>

      {distributors.length === 0 ? (
        <p className="text-sm text-ink-2">
          Add a distributor first. A retailer is always onboarded by a distributor.{' '}
          <Link to="/distributors" className="text-brand hover:underline">
            Go to distributors
          </Link>
        </p>
      ) : (
        <form
          aria-label="Onboard retailer"
          onSubmit={onSubmit}
          noValidate
          className="grid gap-3 md:grid-cols-2"
        >
          <FormField label="Shop name" error={shown.name}>
            <input
              value={values.name}
              onChange={(e) => set({ name: e.target.value })}
              aria-invalid={!!shown.name}
              className={controlClass}
            />
          </FormField>
          <FormField label="Distributor" id={`${uid}-distributor`} error={shown.distributorId}>
            <Select
              inputId={`${uid}-distributor`}
              value={values.distributorId}
              onChange={chooseDistributor}
              invalid={!!shown.distributorId}
              options={[
                { value: '', label: 'Choose a distributor…' },
                ...distributors.map((d) => ({
                  value: d.id,
                  label: `${d.name} (${d.id}) · ${d.state}`,
                })),
              ]}
            />
          </FormField>
          <FormField label="City" error={shown.city}>
            <input
              value={values.city}
              onChange={(e) => set({ city: e.target.value })}
              aria-invalid={!!shown.city}
              className={controlClass}
            />
          </FormField>
          <FormField label="State" id={`${uid}-state`} error={shown.state}>
            <Select
              inputId={`${uid}-state`}
              value={values.state}
              onChange={(state) => set({ state })}
              invalid={!!shown.state}
              options={[
                { value: '', label: 'Choose a state…' },
                ...INDIA_STATES.map((state) => ({ value: state, label: state })),
              ]}
            />
          </FormField>
          <FormField
            label="Phone (optional)"
            error={shown.phone}
            hint="Used to catch duplicate registrations under the same distributor."
          >
            <input
              inputMode="tel"
              value={values.phone}
              onChange={(e) => set({ phone: e.target.value })}
              placeholder="+91 98765 43210"
              aria-invalid={!!shown.phone}
              className={controlClass}
            />
          </FormField>
          <FormField
            label="Onboarded on (optional)"
            id={`${uid}-onboarded-on`}
            error={shown.onboardedOn}
            hint="Leave empty for today. Earlier days count as noon."
          >
            <DatePicker
              id={`${uid}-onboarded-on`}
              max={businessDayKey(now, defaultCommissionConfig.businessTimeZone)}
              value={values.onboardedOn}
              onChange={(onboardedOn) => set({ onboardedOn })}
              invalid={!!shown.onboardedOn}
            />
          </FormField>
          <div className="md:col-span-2">
            <Button type="submit" variant="primary" disabled={create.isPending}>
              {create.isPending ? 'Adding…' : 'Onboard retailer'}
            </Button>
          </div>
        </form>
      )}

      <div aria-live="polite" className="mt-3 space-y-2">
        {serverError && <FormMessage tone="error">{serverError}</FormMessage>}
        {added && (
          <FormMessage tone="success">
            Onboarded {added.name} as {added.id}.{' '}
            <Link to={`/retailers/${added.id}`} className="underline">
              Open
            </Link>
          </FormMessage>
        )}
      </div>
    </Card>
  )
}
