import type {IncomingMessage} from "http"
import {CLIENT_ID_HEADER} from "../rpc.js"

/**
 * Extracts the Push-RPC client id from an incoming request.
 *
 * - For HTTP requests it is read from the `x-rpc-client-id` header.
 * - For WebSocket upgrade requests it is read from the `sec-websocket-protocol` header.
 *
 * Returns undefined if neither is present, so the caller can decide on a fallback.
 *
 * Note: the client id identifies the connecting Push-RPC client, not an end user.
 * It is asserted by the client and is not authenticated by the library. If you need
 * to prevent one client from impersonating another, verify or derive the client id
 * (e.g. from a token your application issued) inside `createConnectionContext`.
 */
export function getClientId(req: IncomingMessage): string | undefined {
  const header = req.headers[CLIENT_ID_HEADER]
  if (header) return Array.isArray(header) ? header[0] : header

  const protocol = req.headers["sec-websocket-protocol"]
  if (protocol) {
    const value = Array.isArray(protocol) ? protocol[0] : protocol
    return value.split(",")[0].trim()
  }

  return undefined
}
