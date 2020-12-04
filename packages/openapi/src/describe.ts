import * as yaml from "js-yaml"
import * as path from "path"
import {Project} from "ts-morph"
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

function filterUndefined(obj) {
  for (const key of Object.keys(obj)) {
    if (obj[key] == undefined) delete obj[key]

    if (typeof obj[key] == "object" && obj[key]) {
      filterUndefined(obj[key])
    }
  }

  return obj
}

export function generateYml({tsConfig, template, baseDir, skip, entryFile, entryType}): string {
  const project = loadProject(path.join(baseDir, tsConfig))

  const file = project.getSourceFile(path.join(baseDir, entryFile))
  if (!file) throw new Error(`Cannot find entry file ${entryFile}`)

  const entryInterface = file.getInterface(entryType)
  if (!entryInterface) throw new Error(`Cannot find entry type ${entryType}`)

  const apiDescriber = new ApiDescriber(baseDir, skip)

  const paths = apiDescriber.describeInterface(entryInterface)

  const result = {
    ...template,
    paths,
    components: {
      ...template.components,
      schemas: apiDescriber.createDefinitionSchemas(),
    },
  }

  return yaml.safeDump(filterUndefined(result))
}
