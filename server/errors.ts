export class HttpError extends Error {
  readonly statusCode: number

  constructor(statusCode: number, message: string) {
    super(message)
    this.name = 'HttpError'
    this.statusCode = statusCode
  }
}

export const notFound = (what: string, id: string) =>
  new HttpError(404, `${what} ${id} was not found`)
