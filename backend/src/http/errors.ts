// An error the caller is meant to see: the status and message go out as the response.
// Anything else thrown becomes a plain 500 with no detail.
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
