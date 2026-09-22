import { dropStaleTestDatabases } from './testing'

/** Runs once before the test suite: clears test database files left behind by any interrupted earlier run. */
export default function setup() {
  dropStaleTestDatabases()
}
