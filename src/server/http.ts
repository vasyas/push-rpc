import * as http from "http"
import {IncomingMessage, ServerResponse} from "http"
import {CLIENT_ID_HEADER} from "../rpc.js"
import {safeParseJson, safeStringify} from "../utils/json.js"

export async function serveHttpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  path: string,
  hooks: HttpServerHooks
) {
  try {
    if (!req.url?.startsWith(path)) {
      res.statusCode = 404
      res.end()
      return
    }

    const clientId = req.headersDistinct[CLIENT_ID_HEADER]?.[0] || "anon"

    const itemName = req.url.slice(path.length + 1)
    const body = safeParseJson(await readBody(req))

    let result: unknown
    switch (req.method) {
      case "POST":
        result = await hooks.call(clientId, itemName, body)
        break
      case "PUT":
        result = await hooks.subscribe(clientId, itemName, body)
        break
      case "PATCH":
        result = await hooks.unsubscribe(clientId, itemName, body)
        break
      default:
        throw new Error(`HTTP Method ${req.method} not supported`)
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
      res.statusMessage = e.message
      const {code, message, stack, ...rest} = e
      if (Object.keys(rest).length > 0) {
        res.setHeader("Content-Type", "application/json")
        res.write(safeStringify(rest))
      }
      res.end()
      return
    } else {
      res.statusCode = 500
      res.statusMessage = e["message"] || "Internal Server Error"
      res.end()
      return
    }
  }
}

function readBody(req: http.IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    let body = ""
    req.on("data", (chunk: Buffer) => {
      body += chunk.toString()
    })
    req.on("end", () => {
      resolve(body)
    })
    req.on("error", (error: any) => {
      reject(error)
    })
  })
}

export type HttpServerHooks = {
  call(clientId: string, itemName: string, parameters: unknown[]): Promise<unknown>
  subscribe(clientId: string, itemName: string, parameters: unknown[]): Promise<unknown>
  unsubscribe(clientId: string, itemName: string, parameters: unknown[]): Promise<unknown>
}
