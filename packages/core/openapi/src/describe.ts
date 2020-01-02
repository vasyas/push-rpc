import * as path from "path"
import {Project} from "ts-morph"
import * as yaml from "write-yaml"
import * as commandLineArgs from "command-line-args"
import * as commandLineUsage from "command-line-usage"

import * as fs from "fs"
import {ApiDescriber} from "./ApiDescriber"

function loadProject(tsConfigFilePath) {
  const project = new Project({
    tsConfigFilePath,
  })

  const diagnostics = project.getPreEmitDiagnostics()

  if (diagnostics.length > 0) {
    console.log("Can't generate API description - compilation failed.")
    console.log(project.formatDiagnosticsWithColorAndContext(diagnostics))
    process.exit(1)
  }

  return project
}

const optionList = [
  {
    name: "tsConfig",
    type: String,
    description: "Path to tsconfig.json",
    typeLabel: "{underline file}",
  },
  {
    name: "apiDescription",
    type: String,
    description: "Path to api-description.json",
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
  const {tsConfig, apiDescription, output, baseDir, skip} = commandLineArgs(optionList)

  if (!tsConfig || !apiDescription || !output) {
    const usage = commandLineUsage(usageSections)
    console.log(usage)
    return
  }

  const description = JSON.parse(fs.readFileSync(path.join(baseDir, apiDescription), "utf8"))

  const project = loadProject(path.join(baseDir, tsConfig))

  const entryFile = project.getSourceFile(description.entry.file)
  if (!entryFile)
    throw new Error(`Cannot find entry file ${description.entry.file}, check api-description.json`)

  const entryInterface = entryFile.getInterface(description.entry.interface)
  if (!entryInterface)
    throw new Error(
      `Cannot find entry interface ${description.entry.interface}, check api-description.json`
    )

  const apiDescriber = new ApiDescriber(baseDir, skip)

  const paths = apiDescriber.describeInterface(entryInterface)

  const result = {
    ...description.template,
    paths,
    components: {
      ...description.template.components,
      schemas: apiDescriber.createDefinitionSchemas(),
    },
  }

  function filterUndefined(obj) {
    for (const key of Object.keys(obj)) {
      if (obj[key] == undefined) delete obj[key]

      if (typeof obj[key] == "object" && obj[key]) {
        filterUndefined(obj[key])
      }
    }

    return obj
  }

  yaml.sync(output, filterUndefined(result))
})()
