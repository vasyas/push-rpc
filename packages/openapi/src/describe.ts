import * as yaml from "js-yaml"
import * as path from "path"
import {Project, TypeLiteralNode} from "ts-morph"
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

export function generateOpenAPI({tsConfig, template, baseDir, skip, entryFile, entryType}) {
  const project = loadProject(path.join(baseDir, tsConfig))

  const file = project.getSourceFile(path.join(baseDir, entryFile))
  if (!file) throw new Error(`Cannot find entry file ${entryFile}`)

  const entryTypeNode = file.getTypeAlias(entryType)
    ? (file.getTypeAlias(entryType).getTypeNode() as TypeLiteralNode)
    : file.getInterface(entryType)

  if (!entryTypeNode) throw new Error(`Cannot find entry interface or type alias ${entryType}`)

  const apiDescriber = new ApiDescriber(baseDir, skip)

  const paths = apiDescriber.describeEntryType(entryTypeNode)

  return {
    ...template,
    paths,
    components: {
      ...template.components,
      schemas: apiDescriber.createDefinitionSchemas(),
    },
  }
}

export function generateYml({tsConfig, template, baseDir, skip, entryFile, entryType}): string {
  const result = generateOpenAPI({tsConfig, template, baseDir, skip, entryFile, entryType})
  return yaml.safeDump(filterUndefined(result))
}
