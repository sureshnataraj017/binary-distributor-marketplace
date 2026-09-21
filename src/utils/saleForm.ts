import { parseDollars } from '@/domain/money'

export interface SaleFormValues {
  product: string
  quantity: string
  amount: string
}

export type SaleFormErrors = Partial<Record<keyof SaleFormValues, string>>

export interface SaleFormInput {
  product: string
  quantity: number
  /** Cents. */
  amount: number
}

/** Mirrors the server's limits so people get instant feedback; the server still validates everything. */
const MAX_AMOUNT_CENTS = 100_000_000_00
const MAX_QUANTITY = 1_000_000

export function validateSaleForm(values: SaleFormValues): {
  errors: SaleFormErrors
  input: SaleFormInput | null
} {
  const errors: SaleFormErrors = {}

  const product = values.product.trim()
  if (!product) errors.product = 'Enter a product name.'
  else if (product.length > 100) errors.product = 'Keep the product name under 100 characters.'

  const quantity = /^\d+$/.test(values.quantity.trim()) ? Number(values.quantity) : Number.NaN
  if (!Number.isInteger(quantity) || quantity < 1)
    errors.quantity = 'Enter a whole number, 1 or more.'
  else if (quantity > MAX_QUANTITY) errors.quantity = 'That quantity is too large.'

  const amount = parseDollars(values.amount)
  if (amount === null) errors.amount = 'Enter an amount like 1000 or 1,250.50 (max 2 decimals).'
  else if (amount <= 0) errors.amount = 'The amount must be more than $0.'
  else if (amount > MAX_AMOUNT_CENTS) errors.amount = "The amount can't exceed $100,000,000."

  if (Object.keys(errors).length > 0 || amount === null) return { errors, input: null }
  return { errors, input: { product, quantity, amount } }
}
