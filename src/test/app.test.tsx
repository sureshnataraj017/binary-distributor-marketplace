import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderApp, store } from './renderApp'

const findCard = async (label: string) => {
  const title = await screen.findByText(label)
  return title.closest('div')!.parentElement as HTMLElement
}

// Data loaded once, up front. The demo network is generated fresh into PostgreSQL for this test file.
const fixtureDistributors = await store.distributors.list()
const fixtureSales = await store.sales.list()
const fixtureRetailers = await store.retailers.list()

describe('routes render with real data', () => {
  it('dashboard shows all nine KPI cards', async () => {
    renderApp('/dashboard')
    for (const label of [
      'Total distributors',
      'Total retailers',
      "Today's sales",
      'Total commissions',
      "Today's onboarding achievement",
      'Distributor commissions',
      'Retailer commissions',
      'Referral commissions',
      'Company downline commission',
    ]) {
      expect(await screen.findByText(label)).toBeInTheDocument()
    }
    expect(await within(await findCard('Total distributors')).findByText('32')).toBeInTheDocument()
  })

  it('the state filter narrows the dashboard numbers', async () => {
    const state = fixtureDistributors[0]!.state
    const expected = fixtureDistributors.filter((d) => d.state === state).length
    renderApp('/dashboard')
    await within(await findCard('Total distributors')).findByText('32')

    await userEvent.selectOptions(screen.getByRole('combobox'), state)

    await within(await findCard('Total distributors')).findByText(String(expected))
    expect(screen.getByText(`Showing ${state} only`)).toBeInTheDocument()
  })

  it('network renders distributor nodes and a company root', async () => {
    renderApp('/distributors/network')
    // React Flow keeps nodes `visibility: hidden` until it can measure them, which jsdom cannot do.
    expect(await screen.findByLabelText(/DIST-001/)).toBeInTheDocument()
    expect(screen.getByText('COMPANY')).toBeInTheDocument()
  })

  it('selecting a node opens its details panel', async () => {
    renderApp('/distributors/network')
    // fireEvent: React Flow disables pointer events on nodes it has not measured, and jsdom cannot measure.
    fireEvent.click(await screen.findByLabelText(/DIST-001/))
    const panel = await screen.findByLabelText(/ details$/)
    expect(within(panel).getByText('View full details')).toHaveAttribute(
      'href',
      '/distributors/DIST-001',
    )
  })

  it('collapse all hides the downline and expand all restores it', async () => {
    renderApp('/distributors/network')
    const nodes = () => screen.getAllByLabelText(/retailers$/)
    await screen.findByLabelText(/DIST-001/)
    const before = nodes().length
    await userEvent.click(screen.getByRole('button', { name: 'Collapse all' }))
    await waitFor(() => expect(nodes().length).toBeLessThan(before))
    await userEvent.click(screen.getByRole('button', { name: 'Expand all' }))
    await waitFor(() => expect(nodes().length).toBe(before))
  })

  it('lists distributors and retailers with the entry buttons', async () => {
    renderApp('/distributors')
    const table = await screen.findByRole('table', { name: 'Distributors' })
    await within(table).findByText('DIST-001')
    expect(screen.getByRole('button', { name: 'Add distributor' })).toBeInTheDocument()
  })

  it('distributor details shows the daily target and retailers', async () => {
    renderApp('/distributors/DIST-001')
    expect(await screen.findByRole('heading', { name: /DIST-001/ })).toBeInTheDocument()
    expect(screen.getByText("Today's target")).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Retailers of this distributor' })).toBeInTheDocument()
  })

  it('shows a not-found state for an unknown distributor', async () => {
    renderApp('/distributors/DIST-999')
    expect(await screen.findByText('Distributor not found')).toBeInTheDocument()
  })

  it('shows a not-found state for an unknown retailer', async () => {
    renderApp('/retailers/RET-0/sales')
    expect(await screen.findByText('Retailer not found')).toBeInTheDocument()
  })

  it('commission ledger lists entries and filters by type', async () => {
    renderApp('/commissions')
    const table = await screen.findByRole('table', { name: 'Commission ledger' })
    await within(table).findAllByText('RETAILER_SALE')
    await userEvent.selectOptions(screen.getByLabelText('Type'), 'DOWNLINE_SALE')
    await waitFor(() => expect(within(table).queryByText('RETAILER_SALE')).not.toBeInTheDocument())
    expect(within(table).getAllByText('DOWNLINE_SALE').length).toBeGreaterThan(0)
  })

  it('referrals page lists referral commissions', async () => {
    renderApp('/referrals')
    expect(await screen.findByRole('table', { name: 'Distributor referrals' })).toBeInTheDocument()
    expect(await screen.findByText('Total referral commission')).toBeInTheDocument()
  })

  it('unknown URLs show 404', async () => {
    renderApp('/nope')
    expect(await screen.findByText('404')).toBeInTheDocument()
  })
})

describe('retailer sales table', () => {
  const retailerId = fixtureSales[0]!.retailerId
  const sales = fixtureSales.filter((s) => s.retailerId === retailerId)

  it('shows every sale with a totals row that adds up', async () => {
    renderApp(`/retailers/${retailerId}/sales`)
    const table = await screen.findByRole('table', { name: 'Retailer sales' })
    await within(table).findByText(sales[0]!.id)
    const footer = table.querySelector('tfoot')!
    const total = sales.reduce((n, s) => n + s.amount, 0)
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: total % 100 ? 2 : 0,
    }).format(total / 100)
    expect(within(footer).getByText(formatted)).toBeInTheDocument()
  })

  it('searching filters the rows and shows an empty state when nothing matches', async () => {
    renderApp(`/retailers/${retailerId}/sales`)
    const table = await screen.findByRole('table', { name: 'Retailer sales' })
    await within(table).findByText(sales[0]!.id)
    await userEvent.type(screen.getByLabelText('Search invoice or product'), 'zzz-no-match')
    expect(await screen.findByText('No sales match your filters')).toBeInTheDocument()
  })

  it('shows the explicit remainder column', async () => {
    renderApp(`/retailers/${retailerId}/sales`)
    expect(await screen.findByRole('columnheader', { name: /Remainder 58%/ })).toBeInTheDocument()
  })
})

describe('record a sale', () => {
  // A different retailer from the sales-table tests above, so their totals are not disturbed.
  const sellerId = fixtureSales[0]!.retailerId
  const soldBefore = new Set(fixtureSales.map((s) => s.retailerId))
  const retailer = fixtureRetailers.find(
    (r) => r.status === 'ACTIVE' && r.id !== sellerId && soldBefore.has(r.id),
  )!

  const openForm = async (retailerId = retailer.id) => {
    renderApp(`/retailers/${retailerId}`)
    await userEvent.click(await screen.findByRole('button', { name: 'Record a sale' }))
    return screen.findByRole('button', { name: 'Record sale' })
  }
  const fill = async (product: string, quantity: string, amount: string) => {
    await userEvent.type(screen.getByLabelText('Product'), product)
    await userEvent.clear(screen.getByLabelText('Quantity'))
    if (quantity) await userEvent.type(screen.getByLabelText('Quantity'), quantity)
    if (amount) await userEvent.type(screen.getByLabelText('Sale amount (USD)'), amount)
  }

  it('previews the split while typing, before anything is sent', async () => {
    await openForm()
    await fill('Product A', '5', '1000')
    const preview = await screen.findByText('Preview of the split')
    const box = preview.parentElement!
    expect(within(box).getByText('$300.00')).toBeInTheDocument()
    expect(within(box).getByText('$100.00')).toBeInTheDocument()
    expect(within(box).getByText('$20.00')).toBeInTheDocument()
    expect(within(box).getByText('$580.00')).toBeInTheDocument()
  })

  it('records the sale on the server, shows its confirmed split, and refreshes the page', async () => {
    const before = (await store.sales.listByRetailer(retailer.id)).length
    await openForm()
    await fill('Product B', '2', '2500')
    await userEvent.click(screen.getByRole('button', { name: 'Record sale' }))

    const status = await screen.findByRole('status')
    expect(status).toHaveTextContent(/Recorded INV-\d+ · \$2,500\.00/)
    expect(status).toHaveTextContent('$750.00') // retailer 30%
    expect(status).toHaveTextContent('$250.00') // distributor 10%
    expect(status).toHaveTextContent('$50.00') // company 2%

    // It really was stored, and the page's own totals caught up (cache invalidation).
    const stored = await store.sales.listByRetailer(retailer.id)
    expect(stored).toHaveLength(before + 1)
    const invoice = stored.at(-1)!.id
    expect(await screen.findByText(invoice, { selector: 'span.font-medium' })).toBeInTheDocument()
    expect(screen.getByText(`See all ${before + 1}`)).toBeInTheDocument()
  })

  it('shows the new entries in the commission ledger', async () => {
    await openForm()
    await fill('Product A', '1', '400')
    await userEvent.click(screen.getByRole('button', { name: 'Record sale' }))
    const invoice = (await screen.findByRole('status')).textContent!.match(/INV-\d+/)![0]

    // The ledger is derived from the stored sale: distributor 10% and company 2% of $400.
    const entries = (await store.ledger()).filter((e) => e.reference === invoice)
    expect(entries.map((e) => [e.type, e.amount]).sort()).toEqual([
      ['DOWNLINE_SALE', 800],
      ['RETAILER_SALE', 4000],
    ])
  })

  it('validates in the browser and sends nothing when the form is invalid', async () => {
    const before = (await store.sales.list()).length
    await openForm()
    await userEvent.clear(screen.getByLabelText('Quantity'))
    await userEvent.click(screen.getByRole('button', { name: 'Record sale' }))

    expect(await screen.findByText('Enter a product name.')).toBeInTheDocument()
    expect(screen.getByText('Enter a whole number, 1 or more.')).toBeInTheDocument()
    expect(screen.getByText(/Enter an amount like/)).toBeInTheDocument()
    expect(await store.sales.list()).toHaveLength(before)
  })

  it("shows the server's reason when it refuses the sale, and stores nothing", async () => {
    // Status is ACTIVE so the UI allows it, but the onboarding date is in the future: an invalid record.
    // Only the server's rules can catch this, which is the point of validating there too.
    const invalid = fixtureRetailers.find(
      (r) => r.status === 'ACTIVE' && Date.parse(r.onboardedAt) > Date.now(),
    )!
    const before = (await store.sales.list()).length

    await openForm(invalid.id)
    await fill('Product A', '1', '100')
    await userEvent.click(screen.getByRole('button', { name: 'Record sale' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /not eligible for sales \(FUTURE_DATE\)/,
    )
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(await store.sales.list()).toHaveLength(before)
  })

  it('disables recording for a cancelled retailer and says why', async () => {
    const cancelled = fixtureRetailers.find((r) => r.status === 'CANCELLED')!
    renderApp(`/retailers/${cancelled.id}`)
    expect(
      await screen.findByText("Sales can't be recorded for a cancelled retailer."),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Record a sale' })).toBeDisabled()
  })
})
