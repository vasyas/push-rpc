import * as http from "http"
import {IncomingMessage, ServerResponse} from "http"
import {ERROR_HEADER, RpcConnectionContext, RpcError, RpcErrors} from "../rpc.js"
import {safeParseJson, safeStringify} from "../utils/json.js"
import {log} from "../logger.js"
import {decompressRequest} from "../utils/server.js"

export async function serveHttpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  path: string,
  hooks: HttpServerHooks,
  createConnectionContext: (
    req: IncomingMessage,
    res: ServerResponse,
  ) => Promise<RpcConnectionContext>,
  maxRequestSize: number,
) {
  // if port is in options - response 404 on other URLs
  // otherwise simply handle request

  if (req.url?.startsWith(path)) {
    try {
      const ctx = await createConnectionContext(req, res)

      const itemName = req.url.slice(path.length + 1)

      const isJson = req.headers["content-type"]?.includes("application/json") ?? false
      const textBody = await readBody(req, maxRequestSize)
      let body = isJson && !!textBody ? safeParseJson(textBody) : []

      if (!Array.isArray(body)) {
        body = [body]
      }

      let result: unknown
      switch (req.method) {
        case "GET":
        case "POST":
          result = await hooks.call(ctx, itemName, body)
          break
        case "PUT":
          result = await hooks.subscribe(ctx, itemName, body)
          break
        case "PATCH":
          result = await hooks.unsubscribe(ctx, itemName, body)
          break
        default:
          res.statusCode = 404
          res.end()
          return
      }

      if (typeof result == "undefined") {
        res.statusCode = 204
        res.end()
        return
      }

      if (typeof result == "string") {
        res.setHeader("Content-Type", "text/plain")
        res.write(result)
        res.end()
        return
      }

      res.setHeader("Content-Type", "application/json")
      res.write(safeStringify(result))
      res.end()
    } catch (e: any) {
      if (e.code && typeof e.code == "number" && e.code >= 100 && e.code < 600) {
        res.statusCode = e.code

        res.setHeader(ERROR_HEADER, encodeURIComponent(e["message"] ?? ""))
        const {code, message, stack, ...rest} = e
        if (Object.keys(rest).length > 0) {
          res.setHeader("Content-Type", "application/json")
          res.write(safeStringify(rest))
        }
        res.end()
        return
      } else {
        log.warn(`Error in ${req.url}.`, e)

        res.statusCode = 500
        if (e["message"]) {
          res.setHeader(ERROR_HEADER, encodeURIComponent(e["message"]))
        }
        res.end()
        return
      }
    }
  }
}

function readBody(req: http.IncomingMessage, maxRequestSize: number): Promise<string> {
  const decompressed = decompressRequest(req)

  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    let finished = false

    decompressed.on("data", (chunk: Buffer) => {
      if (finished) return

      // Measured after decompression, so a small compressed payload that expands to a huge
      // body (decompression bomb) is stopped here instead of being buffered into memory.
      size += chunk.length

      if (size > maxRequestSize) {
        finished = true
        chunks.length = 0 // release what was buffered
        req.pause() // stop reading from the socket to bound memory and CPU
        reject(new RpcError(RpcErrors.PayloadTooLarge, "Request body too large"))
        return
      }

      chunks.push(chunk)
    })
    decompressed.on("end", () => {
      if (finished) return
      finished = true
      // Concatenate as bytes and decode once, so multi-byte characters split across chunk
      // boundaries are not corrupted.
      resolve(Buffer.concat(chunks).toString("utf8"))
    })
    decompressed.on("error", (error: any) => {
      if (finished) return
      finished = true
      reject(error)
    })
  })
}

export type HttpServerHooks = {
  call(ctx: RpcConnectionContext, itemName: string, parameters: unknown[]): Promise<unknown>
  subscribe(
    clientId: RpcConnectionContext,
    itemName: string,
    parameters: unknown[],
  ): Promise<unknown>
  unsubscribe(
    clientId: RpcConnectionContext,
    itemName: string,
    parameters: unknown[],
  ): Promise<unknown>
}
