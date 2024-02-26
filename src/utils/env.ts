export enum Environment {
  Browser,
  Node,
  ReactNative,
}

export const environment = getEnvironment()

function getEnvironment(): Environment {
  if (typeof document !== "undefined") {
    return Environment.Browser
  } else if (typeof navigator !== "undefined" && navigator.product === "ReactNative") {
    return Environment.ReactNative
  } else {
    return Environment.Node
  }
}
