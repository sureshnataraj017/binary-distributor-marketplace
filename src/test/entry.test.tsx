import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { emptyStore, renderApp } from './renderApp'

/**
 * The first-time experience: a completely empty PostgreSQL database, and a person entering the data
 * one record at a time through the forms. The steps depend on each other, like a real session does.
 */
const onEmpty = { onEmptyDatabase: true }
const form = (name: string) => within(screen.getByRole('form', { name }))

describe('starting from an empty database', () => {
  it('shows a welcome and empty states instead of fake data', async () => {
    renderApp('/dashboard', onEmpty)
    expect(await screen.findByText("Welcome. There's no data yet.")).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Add your first distributor' })).toHaveAttribute(
      'href',
      '/distributors',
    )
  })

  it('the network, distributors, retailers and referrals pages explain what to do', async () => {
    renderApp('/distributors', onEmpty)
    expect(await screen.findByText('No distributors yet')).toBeInTheDocument()
    renderApp('/retailers', onEmpty)
    expect(await screen.findByText('No retailers yet')).toBeInTheDocument()
    expect(screen.getByText(/Add a distributor first/)).toBeInTheDocument()
    renderApp('/referrals', onEmpty)
    expect(await screen.findByText('No referrals yet')).toBeInTheDocument()
  })

  it('adds the first distributor: top level only, because there is nobody to place it under', async () => {
    renderApp('/distributors', onEmpty)
    await userEvent.click(await screen.findByRole('button', { name: 'Add distributor' }))
    expect(
      screen.getByText(/your first distributor, placed directly under the company/),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Under another distributor')).toBeDisabled()

    const f = form('Add distributor')
    await userEvent.type(f.getByLabelText('Name'), 'Asha')
    await userEvent.selectOptions(f.getByLabelText('State'), 'Tamil Nadu')
    await userEvent.type(f.getByLabelText('City'), 'Chennai')
    await userEvent.click(f.getByRole('button', { name: 'Add distributor' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Added Asha as DIST-001')
    expect(await emptyStore.distributors.list()).toMatchObject([
      { id: 'DIST-001', name: 'Asha', state: 'Tamil Nadu', parentId: null, position: null },
    ])
    // The list refreshed without a reload.
    expect(
      await within(await screen.findByRole('table', { name: 'Distributors' })).findByText(
        'DIST-001',
      ),
    ).toBeInTheDocument()
  })

  it('validates in the browser first, and sends nothing', async () => {
    renderApp('/distributors', onEmpty)
    await userEvent.click(await screen.findByRole('button', { name: 'Add distributor' }))
    await userEvent.click(form('Add distributor').getByRole('button', { name: 'Add distributor' }))
    expect(await screen.findByText('Enter a name.')).toBeInTheDocument()
    expect(screen.getByText('Choose a state.')).toBeInTheDocument()
    expect(screen.getByText('Enter a city.')).toBeInTheDocument()
    expect(await emptyStore.distributors.list()).toHaveLength(1)
  })

  it('places the second one under the first, on a free side, with a referrer', async () => {
    renderApp('/distributors', onEmpty)
    await userEvent.click(await screen.findByRole('button', { name: 'Add distributor' }))
    const f = form('Add distributor')
    await userEvent.type(f.getByLabelText('Name'), 'Bala')
    await userEvent.selectOptions(f.getByLabelText('State'), 'Kerala')
    await userEvent.type(f.getByLabelText('City'), 'Kochi')
    await userEvent.click(f.getByLabelText('Under another distributor'))
    await userEvent.selectOptions(f.getByLabelText('Parent distributor'), 'DIST-001')
    // Both sides of DIST-001 are free, so the person must pick one.
    expect(
      within(f.getByLabelText('Side'))
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Choose a side…', 'LEFT', 'RIGHT'])
    await userEvent.selectOptions(f.getByLabelText('Side'), 'LEFT')
    await userEvent.selectOptions(f.getByLabelText(/Referred by/), 'DIST-001')
    await userEvent.click(f.getByRole('button', { name: 'Add distributor' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Added Bala as DIST-002')
    const stored = (await emptyStore.distributors.list()).find((d) => d.id === 'DIST-002')!
    expect(stored).toMatchObject({ parentId: 'DIST-001', position: 'LEFT', referredBy: 'DIST-001' })
  })

  it('only offers sides that are still free, and auto-picks the last one', async () => {
    renderApp('/distributors', onEmpty)
    await userEvent.click(await screen.findByRole('button', { name: 'Add distributor' }))
    const f = form('Add distributor')
    await userEvent.click(f.getByLabelText('Under another distributor'))
    // DIST-001's LEFT is taken by Bala, so only RIGHT remains and is chosen automatically.
    await userEvent.selectOptions(f.getByLabelText('Parent distributor'), 'DIST-001')
    expect(f.getByLabelText('Side')).toHaveValue('RIGHT')
    // Bala (DIST-002) has both sides free.
    const options = within(f.getByLabelText('Parent distributor'))
      .getAllByRole('option')
      .map((o) => o.textContent)
    expect(options.some((o) => o?.includes('Asha (DIST-001) · free: RIGHT'))).toBe(true)
    expect(options.some((o) => o?.includes('Bala (DIST-002) · free: LEFT, RIGHT'))).toBe(true)
  })

  it('onboards a retailer under a distributor; the state and city are suggested from the distributor', async () => {
    renderApp('/retailers', onEmpty)
    await userEvent.click(await screen.findByRole('button', { name: 'Onboard retailer' }))
    const f = form('Onboard retailer')
    await userEvent.type(f.getByLabelText('Shop name'), 'Sri Traders')
    await userEvent.selectOptions(f.getByLabelText('Distributor'), 'DIST-002')
    expect(f.getByLabelText('State')).toHaveValue('Kerala')
    expect(f.getByLabelText('City')).toHaveValue('Kochi')
    await userEvent.type(f.getByLabelText(/Phone/), '+91 98765 43210')
    await userEvent.click(f.getByRole('button', { name: 'Onboard retailer' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Onboarded Sri Traders as RET-1001')
    expect(await emptyStore.retailers.list()).toMatchObject([
      { id: 'RET-1001', distributorId: 'DIST-002', status: 'ACTIVE' },
    ])
  })

  it('refuses the same phone number twice under one distributor and shows why', async () => {
    renderApp('/retailers', onEmpty)
    await userEvent.click(await screen.findByRole('button', { name: 'Onboard retailer' }))
    const f = form('Onboard retailer')
    await userEvent.type(f.getByLabelText('Shop name'), 'Copycat')
    await userEvent.selectOptions(f.getByLabelText('Distributor'), 'DIST-002')
    await userEvent.type(f.getByLabelText(/Phone/), '9876543210')
    await userEvent.click(f.getByRole('button', { name: 'Onboard retailer' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /already registered with this phone number/,
    )
    expect(await emptyStore.retailers.list()).toHaveLength(1)
  })

  it('records a sale for that retailer and stores the server-calculated split', async () => {
    renderApp('/retailers/RET-1001', onEmpty)
    await userEvent.click(await screen.findByRole('button', { name: 'Record a sale' }))
    const f = form('Record sale')
    await userEvent.type(f.getByLabelText('Product'), 'Product A')
    await userEvent.type(f.getByLabelText('Sale amount (USD)'), '1000')
    await userEvent.click(f.getByRole('button', { name: 'Record sale' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Recorded INV-1001')
    expect(await emptyStore.sales.list()).toMatchObject([
      { id: 'INV-1001', amount: 100_000, retailerCommission: 30_000, remainder: 58_000 },
    ])
  })

  it('records a referral fee: the referrer and the 10% commission come from the server', async () => {
    renderApp('/referrals', onEmpty)
    await userEvent.click(await screen.findByRole('button', { name: 'Record referral fee' }))
    const f = form('Record referral fee')
    // Only DIST-002 has a referrer (Asha), so only it can be chosen.
    expect(
      within(f.getByLabelText('Referred distributor'))
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Choose a distributor…', 'Bala (DIST-002) · referred by Asha'])
    await userEvent.selectOptions(f.getByLabelText('Referred distributor'), 'DIST-002')
    await userEvent.type(f.getByLabelText(/Fee/), '500')
    expect(await screen.findByText('Referral commission: $50.00')).toBeInTheDocument()
    await userEvent.click(f.getByRole('button', { name: 'Record referral' }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Recorded REF-0001: $50.00 commission for DIST-001, pending payment.',
    )
    expect(await emptyStore.referrals.list()).toMatchObject([
      {
        id: 'REF-0001',
        referringDistributorId: 'DIST-001',
        commission: 5_000,
        paymentStatus: 'PENDING',
      },
    ])
  })

  it('marks the referral paid from the table', async () => {
    renderApp('/referrals', onEmpty)
    await userEvent.click(await screen.findByRole('button', { name: 'Mark REF-0001 as paid' }))
    await waitFor(async () =>
      expect((await emptyStore.referrals.list())[0]!.paymentStatus).toBe('PAID'),
    )
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Mark REF-0001 as paid' }),
      ).not.toBeInTheDocument(),
    )
  })

  it('deactivating a retailer stops sales; cancelling is final and asks first', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderApp('/retailers/RET-1001', onEmpty)

    await userEvent.click(await screen.findByRole('button', { name: 'Deactivate' }))
    await waitFor(async () =>
      expect((await emptyStore.retailers.get('RET-1001'))!.status).toBe('DEACTIVATED'),
    )
    expect(
      await screen.findByText("Sales can't be recorded for a deactivated retailer."),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Record a sale' })).toBeDisabled()

    await userEvent.click(await screen.findByRole('button', { name: 'Cancel retailer' }))
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('can never be reactivated'))
    await waitFor(async () =>
      expect((await emptyStore.retailers.get('RET-1001'))!.status).toBe('CANCELLED'),
    )
    // Once cancelled there is nothing left to change.
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Reactivate' })).not.toBeInTheDocument(),
    )
    expect(screen.queryByRole('button', { name: 'Cancel retailer' })).not.toBeInTheDocument()
    confirm.mockRestore()
  })

  it('does nothing if the person declines the cancel confirmation', async () => {
    // A second retailer, so the first one can stay cancelled.
    const created = await emptyStore.retailers.create({
      name: 'Keep Me',
      distributorId: 'DIST-002',
      state: 'Kerala',
      city: 'Kochi',
      phone: null,
      onboardedAt: new Date(Date.now() - 1000).toISOString(),
      status: 'ACTIVE',
    })
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderApp(`/retailers/${created.id}`, onEmpty)
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel retailer' }))
    expect((await emptyStore.retailers.get(created.id))!.status).toBe('ACTIVE')
  })
})
