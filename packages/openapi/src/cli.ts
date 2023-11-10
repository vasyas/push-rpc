import path from "path"
import commandLineArgs from "command-line-args"
import commandLineUsage from "command-line-usage"
import fs from "fs"
import {generateYml} from "./describe"

const optionList = [
  {
    name: "tsConfig",
    type: String,
    description: "Path to tsconfig.json",
    typeLabel: "{underline file}",
  },
  {
    name: "apiTemplate",
    type: String,
    description: "Default values for OpenAPI JSON",
    typeLabel: "{underline file}",
  },
  {name: "output", type: String, description: "Output file", typeLabel: "{underline file}"},
  {
    name: "baseDir",
    type: String,
    description: "Base dir to look for input files.\nDefault to current directory.",
    typeLabel: "{underline directory}",
  },
  {
    name: "skip",
    type: String,
    description: "Skip interfaces starting with this prefix.\nDefault to skip nothing",
    typeLabel: "{underline string}",
  },
  {
    name: "entryFile",
    type: String,
    description: "TypeScript file to look for entry type",
    typeLabel: "{underline file}",
  },
  {
    name: "entryType",
    type: String,
    description: "Type definition that is root of the API",
    typeLabel: "{underline TS type name}",
  },
]

const usageSections = [
  {
    header: "node ./node_modules/@push-rpc/openapi/lib/describe.js",
    content: "Generate OpenAPI API description based on TypeScript interfaces.",
  },
  {
    header: "Options",
    optionList,
  },
]
;(() => {
  const {
    tsConfig,
    apiTemplate,
    output,
    baseDir = ".",
    skip,
    entryFile,
    entryType,
  } = commandLineArgs(optionList)

  if (!tsConfig || !apiTemplate || !output || !entryFile || !entryType) {
    const usage = commandLineUsage(usageSections)
    console.log(usage)
    return
  }

  const template = JSON.parse(fs.readFileSync(path.join(baseDir, apiTemplate), "utf8"))

  const yaml = generateYml({tsConfig, template, baseDir, skip, entryFile, entryType})

  fs.writeFileSync(output, yaml)
})()
