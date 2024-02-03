import * as http from "http"
import * as zlib from "zlib"
import {PassThrough as PassThroughStream, pipeline as streamPipeline} from "stream"
import * as Stream from "stream"

export function decompressRequest(request: http.IncomingMessage): Stream {
  const contentEncoding = (request.headers["content-encoding"] || "").toLowerCase()

  if (!["gzip", "deflate", "br"].includes(contentEncoding)) {
    return request
  }

  const isBrotli = contentEncoding === "br"

  const decompress = isBrotli ? zlib.createBrotliDecompress() : zlib.createUnzip()
  const stream = new PassThroughStream()

  decompress.on("error", (error: any) => {
    // Ignore empty request
    if (error.code === "Z_BUF_ERROR") {
      stream.end()
      return
    }

    stream.emit("error", error)
  })

  return streamPipeline(request, decompress, stream, () => {})
}
