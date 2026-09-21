import { describe, expect, it } from 'vitest'
import { validateSaleForm } from './saleForm'

const valid = { product: 'Product A', quantity: '5', amount: '1,000' }

describe('validateSaleForm', () => {
  it('accepts a valid form and converts to cents', () => {
    expect(validateSaleForm(valid)).toEqual({
      errors: {},
      input: { product: 'Product A', quantity: 5, amount: 100_000 },
    })
  })

  it('trims the product name', () => {
    expect(validateSaleForm({ ...valid, product: '  Widget  ' }).input?.product).toBe('Widget')
  })

  it.each([
    ['product', { product: '   ' }],
    ['product', { product: 'x'.repeat(101) }],
    ['quantity', { quantity: '0' }],
    ['quantity', { quantity: '2.5' }],
    ['quantity', { quantity: '-1' }],
    ['quantity', { quantity: '' }],
    ['quantity', { quantity: '1000001' }],
    ['amount', { amount: '' }],
    ['amount', { amount: '0' }],
    ['amount', { amount: '0.00' }],
    ['amount', { amount: '12.345' }],
    ['amount', { amount: 'lots' }],
    ['amount', { amount: '999,999,999' }],
  ])('flags an invalid %s (%j)', (field, override) => {
    const result = validateSaleForm({ ...valid, ...override })
    expect(result.input).toBeNull()
    expect(result.errors).toHaveProperty(field)
  })

  it('reports every problem at once', () => {
    const { errors } = validateSaleForm({ product: '', quantity: '0', amount: '' })
    expect(Object.keys(errors).sort()).toEqual(['amount', 'product', 'quantity'])
  })
})
