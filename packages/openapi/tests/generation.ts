import {generateYml} from "../src"
import {assert} from "chai"
import {generateOpenAPI} from "../src/describe"

describe("OpenAPI generation", () => {
  const tsConfig = "tsconfig.json"
  const template = {}
  const baseDir = "."

  it.skip("partial props have type", async () => {
    const yaml = generateOpenAPI({
      tsConfig,
      template,
      baseDir,
      skip: null,
      entryFile: "./tests/api.ts",
      entryType: "Service",
    })

    const req = yaml.paths["/updateModel"].post.requestBody.content["application/json"]

    console.dir(req, {depth: 1000})

    assert.equal(req.schema.properties.pk.type, "number")
    assert.equal(req.schema.properties.name.type, "string")
  })
})
