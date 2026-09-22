import { useId, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { FormField, FormMessage, controlClass } from '@/components/common/FormField'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { DatePicker } from '@/components/ui/DatePicker'
import { Select } from '@/components/ui/Select'
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
  const uid = useId()

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
            <FormField label="Parent distributor" id={`${uid}-parent`} error={shown.parentId}>
              <Select
                inputId={`${uid}-parent`}
                value={values.parentId}
                onChange={chooseParent}
                invalid={!!shown.parentId}
                options={[
                  { value: '', label: 'Choose a distributor with a free side…' },
                  ...openSlots.map(({ parent, free }) => ({
                    value: parent.id,
                    label: `${parent.name} (${parent.id}) · free: ${free.join(', ')}`,
                  })),
                ]}
              />
            </FormField>
            <FormField label="Side" id={`${uid}-side`} error={shown.position}>
              <Select
                inputId={`${uid}-side`}
                value={values.position}
                disabled={!values.parentId}
                onChange={(position) => set({ position: position as Position | '' })}
                invalid={!!shown.position}
                options={[
                  { value: '', label: 'Choose a side…' },
                  ...freeSides.map((side) => ({ value: side, label: side })),
                ]}
              />
            </FormField>
          </>
        )}

        <FormField
          label="Referred by (optional)"
          id={`${uid}-referred-by`}
          hint="Who recruited them. This is separate from where they are placed."
        >
          <Select
            inputId={`${uid}-referred-by`}
            value={values.referredBy}
            onChange={(referredBy) => set({ referredBy })}
            options={[
              { value: '', label: 'Nobody' },
              ...distributors.map((d) => ({ value: d.id, label: `${d.name} (${d.id})` })),
            ]}
          />
        </FormField>
        <FormField
          label="Joined on (optional)"
          id={`${uid}-joined-on`}
          error={shown.joinedOn}
          hint="Leave empty for today."
        >
          <DatePicker
            id={`${uid}-joined-on`}
            max={businessDayKey(now, defaultCommissionConfig.businessTimeZone)}
            value={values.joinedOn}
            onChange={(joinedOn) => set({ joinedOn })}
            invalid={!!shown.joinedOn}
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
            Added {added.name} as {added.id}.{' '}
            <Link to={`/distributors/${added.id}`} className="underline">
              Open
            </Link>
          </FormMessage>
        )}
      </div>
    </Card>
  )
}
