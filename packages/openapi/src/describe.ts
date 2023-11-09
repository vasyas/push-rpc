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

export function generateOpenAPI(req: {
  tsConfig: string
  template: any
  baseDir: string
  skip?: string
  entryFile: string
  entryType: string
}) {
  const project = loadProject(path.join(req.baseDir, req.tsConfig))

  const file = project.getSourceFile(path.join(req.baseDir, req.entryFile))
  if (!file) throw new Error(`Cannot find entry file ${req.entryFile}`)

  const entryTypeNode = file.getTypeAlias(req.entryType)
    ? (file.getTypeAlias(req.entryType).getTypeNode() as TypeLiteralNode)
    : file.getInterface(req.entryType)

  if (!entryTypeNode) throw new Error(`Cannot find entry interface or type alias ${req.entryType}`)

  const apiDescriber = new ApiDescriber(req.baseDir, req.skip)

  const paths = apiDescriber.describeEntryType(entryTypeNode)

  return {
    ...req.template,
    paths,
    components: {
      ...req.template.components,
      schemas: apiDescriber.createDefinitionSchemas(),
    },
  }
}

export function generateYml(req: {
  tsConfig: string
  template: any
  baseDir: string
  skip?: string
  entryFile: string
  entryType: string
}): string {
  const result = generateOpenAPI(req)
  return yaml.safeDump(filterUndefined(result))
}
