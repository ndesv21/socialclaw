export class AppError extends Error {
  constructor(
    message,
    { statusCode = 400, code = "bad_request", retryable = false, details = null } = {}
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.retryable = retryable;
    this.details = details;
  }
}
