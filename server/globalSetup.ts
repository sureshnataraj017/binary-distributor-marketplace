import { dropStaleTestSchemas } from './testing'

/** Runs once before the test suite: clears schemas left behind by any interrupted earlier run. */
export default async function setup() {
  await dropStaleTestSchemas()
}
