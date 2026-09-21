import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { FormField, FormMessage, controlClass } from '@/components/common/FormField'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { defaultCommissionConfig } from '@/config/commissionConfig'
import { INDIA_STATES } from '@/config/indiaStates'
import { businessDayKey } from '@/domain/dateUtils'
import { findOpenSlots } from '@/domain/treeBuilder'
import { useCreateDistributor } from '@/hooks/useEntryMutations'
import { useNow } from '@/hooks/useNow'
import { ApiError } from '@/services/apiClient'
import type { Distributor, Position } from '@/types'
import {
  EMPTY_DISTRIBUTOR_FORM,
  validateDistributorForm,
  type DistributorFormValues,
} from '@/utils/entryForms'

interface Props {
  /** Every distributor (not filtered by state), so any of them can be chosen as a parent or referrer. */
  distributors: readonly Distributor[]
  onClose: () => void
}

export function AddDistributorForm({ distributors, onClose }: Props) {
  const [values, setValues] = useState<DistributorFormValues>(EMPTY_DISTRIBUTOR_FORM)
  const [submitted, setSubmitted] = useState(false)
  const [added, setAdded] = useState<Distributor | null>(null)
  const create = useCreateDistributor()
  const now = useNow()

  const openSlots = useMemo(() => findOpenSlots(distributors), [distributors])
  const isFirst = distributors.length === 0
  const freeSides: readonly Position[] =
    openSlots.find((s) => s.parent.id === values.parentId)?.free ?? []

  const { errors, input } = validateDistributorForm(values, now)
  const shown = submitted ? errors : {}

  const set = (patch: Partial<DistributorFormValues>) => {
    setValues((current) => ({ ...current, ...patch }))
    setAdded(null)
    if (create.isError) create.reset()
  }

  const chooseParent = (parentId: string) => {
    const sides = openSlots.find((s) => s.parent.id === parentId)?.free ?? []
    // With only one side left there is nothing to decide, so pick it.
    set({ parentId, position: sides.length === 1 ? sides[0]! : '' })
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    setSubmitted(true)
    if (!input) return
    create.mutate(input, {
      onSuccess: (distributor) => {
        setAdded(distributor)
        setValues(EMPTY_DISTRIBUTOR_FORM)
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
          <h2 className="font-semibold">Add a distributor</h2>
          <p className="text-xs text-ink-2">
            {isFirst
              ? 'This will be your first distributor, placed directly under the company.'
              : 'Each distributor can have one LEFT and one RIGHT child. Add them one at a time.'}
          </p>
        </div>
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>

      <form
        aria-label="Add distributor"
        onSubmit={onSubmit}
        noValidate
        className="grid gap-3 md:grid-cols-2"
      >
        <FormField label="Name" error={shown.name}>
          <input
            value={values.name}
            onChange={(e) => set({ name: e.target.value })}
            aria-invalid={!!shown.name}
            className={controlClass}
          />
        </FormField>
        <FormField label="State" error={shown.state}>
          <select
            value={values.state}
            onChange={(e) => set({ state: e.target.value })}
            aria-invalid={!!shown.state}
            className={controlClass}
          >
            <option value="">Choose a state…</option>
            {INDIA_STATES.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="City" error={shown.city}>
          <input
            value={values.city}
            onChange={(e) => set({ city: e.target.value })}
            aria-invalid={!!shown.city}
            className={controlClass}
          />
        </FormField>
        <FormField
          label="Daily onboarding target"
          error={shown.dailyTarget}
          hint={`Default is ${defaultCommissionConfig.onboarding.defaultDailyTarget} retailers a day.`}
        >
          <input
            inputMode="numeric"
            value={values.dailyTarget}
            onChange={(e) => set({ dailyTarget: e.target.value })}
            aria-invalid={!!shown.dailyTarget}
            className={controlClass}
          />
        </FormField>

        <fieldset className="md:col-span-2">
          <legend className="mb-1 text-xs font-medium text-ink-2">Placement</legend>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="placement"
                checked={values.placement === 'TOP'}
                onChange={() => set({ placement: 'TOP', parentId: '', position: '' })}
              />
              Directly under the company (top level)
            </label>
            <label className={`flex items-center gap-2 ${isFirst ? 'text-muted' : ''}`}>
              <input
                type="radio"
                name="placement"
                disabled={isFirst || openSlots.length === 0}
                checked={values.placement === 'UNDER'}
                onChange={() => set({ placement: 'UNDER' })}
              />
              Under another distributor
            </label>
          </div>
        </fieldset>

        {values.placement === 'UNDER' && (
          <>
            <FormField label="Parent distributor" error={shown.parentId}>
              <select
                value={values.parentId}
                onChange={(e) => chooseParent(e.target.value)}
                aria-invalid={!!shown.parentId}
                className={controlClass}
              >
                <option value="">Choose a distributor with a free side…</option>
                {openSlots.map(({ parent, free }) => (
                  <option key={parent.id} value={parent.id}>
                    {parent.name} ({parent.id}) · free: {free.join(', ')}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Side" error={shown.position}>
              <select
                value={values.position}
                disabled={!values.parentId}
                onChange={(e) => set({ position: e.target.value as Position })}
                aria-invalid={!!shown.position}
                className={controlClass}
              >
                <option value="">Choose a side…</option>
                {freeSides.map((side) => (
                  <option key={side} value={side}>
                    {side}
                  </option>
                ))}
              </select>
            </FormField>
          </>
        )}

        <FormField
          label="Referred by (optional)"
          hint="Who recruited them. This is separate from where they are placed."
        >
          <select
            value={values.referredBy}
            onChange={(e) => set({ referredBy: e.target.value })}
            className={controlClass}
          >
            <option value="">Nobody</option>
            {distributors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.id})
              </option>
            ))}
          </select>
        </FormField>
        <FormField
          label="Joined on (optional)"
          error={shown.joinedOn}
          hint="Leave empty for today."
        >
          <input
            type="date"
            max={businessDayKey(now, defaultCommissionConfig.businessTimeZone)}
            value={values.joinedOn}
            onChange={(e) => set({ joinedOn: e.target.value })}
            aria-invalid={!!shown.joinedOn}
            className={controlClass}
          />
        </FormField>

        <div className="md:col-span-2">
          <Button type="submit" variant="primary" disabled={create.isPending}>
            {create.isPending ? 'Adding…' : 'Add distributor'}
          </Button>
        </div>
      </form>

      <div aria-live="polite" className="mt-3 space-y-2">
        {serverError && <FormMessage tone="error">{serverError}</FormMessage>}
        {added && (
          <FormMessage tone="success">
            ✓ Added {added.name} as {added.id}.{' '}
            <Link to={`/distributors/${added.id}`} className="underline">
              Open
            </Link>
          </FormMessage>
        )}
      </div>
    </Card>
  )
}
