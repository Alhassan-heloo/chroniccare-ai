import type { ErrorRequestHandler, RequestHandler } from "express";

export class HttpError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
  }
}

export const notFound: RequestHandler = (_request, _response, next) => {
  next(new HttpError(404, "NOT_FOUND", "API route not found."));
};

export function errorHandler(reportError: () => void = () => console.error("API request failed.")): ErrorRequestHandler {
  return (error: unknown, _request, response, next) => {
    if (response.headersSent) { next(error); return; }
    if (error instanceof HttpError) {
      response.status(error.status).json({ error: { code: error.code, message: error.message } });
      return;
    }
    const type = error !== null && typeof error === "object" && "type" in error ? error.type : undefined;
    if (type === "entity.parse.failed") {
      response.status(400).json({ error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } });
    } else if (type === "entity.too.large") {
      response.status(413).json({ error: { code: "PAYLOAD_TOO_LARGE", message: "Request body exceeds the size limit." } });
    } else if (type === "encoding.unsupported" || type === "charset.unsupported") {
      response.status(415).json({ error: { code: "UNSUPPORTED_ENCODING", message: "Request encoding is not supported." } });
    } else {
      reportError();
      response.status(500).json({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } });
    }
  };
}
