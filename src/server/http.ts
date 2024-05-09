import * as http from "http"
import {IncomingMessage, ServerResponse} from "http"
import {RpcConnectionContext} from "../rpc.js"
import {safeParseJson, safeStringify} from "../utils/json.js"
import {log} from "../logger.js"
import {decompressRequest} from "../utils/server.js"

export async function serveHttpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  path: string,
  hooks: HttpServerHooks,
  createConnectionContext: (req: IncomingMessage, res: ServerResponse) => Promise<RpcConnectionContext>,
) {
  // if port is in options - response 404 on other URLs
  // oherwise just handle request

  if (req.url?.startsWith(path)) {
    try {
      const ctx = await createConnectionContext(req, res)

      const itemName = req.url.slice(path.length + 1)

      const isJson = req.headers["content-type"]?.includes("application/json") ?? false
      const textBody = await readBody(req)
      let body = isJson && !!textBody ? safeParseJson(textBody) : []

      if (!Array.isArray(body)) {
        body = [body]
      }

      let result: unknown
      switch (req.method) {
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
      if (e.code) {
        res.statusCode = e.code

        if (e.message) {
          res.setHeader("X-Error", e["message"])
        }
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
          res.setHeader("X-Error", e["message"])
        }
        res.end()
        return
      }
    }
  }
}

function readBody(req: http.IncomingMessage) {
  const decompressed = decompressRequest(req)

  return new Promise<string>((resolve, reject) => {
    let body = ""
    decompressed.on("data", (chunk: Buffer) => {
      body += chunk.toString()
    })
    decompressed.on("end", () => {
      resolve(body)
    })
    decompressed.on("error", (error: any) => {
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
