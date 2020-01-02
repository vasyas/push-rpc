export class RemoteMethodDescription {
  getMethod(): "GET" | "POST" {
    return this.operationName.startsWith("get") ? "GET" : "POST"
  }

  getUrl() {
    return "/" + camelCaseToDash(this.stripOperationPrefix())
  }
}
