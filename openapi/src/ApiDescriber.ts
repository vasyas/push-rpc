import * as path from "path"
import {
  EnumDeclaration,
  InterfaceDeclaration,
  MethodSignature,
  ObjectFlags,
  PropertySignature,
  Type,
} from "ts-morph"

export class ApiDescriber {
  constructor(private baseDir: string, private skipPrefix?: string) {}

  describeInterface(i: InterfaceDeclaration, prefix = ""): any {
    if (this.skipPrefix && prefix.startsWith(this.skipPrefix)) {
      return {}
    }

    let paths = {}

    for (const method of i.getMethods()) {
      paths[prefix + method.getName()] = {
        post: {
          requestBody: this.requestBody(method),
          responses: this.operationResponses(method),
        },
      }
    }

    for (const prop of i.getProperties()) {
      const type = prop.getTypeNodeOrThrow().getType()

      if (type.isInterface()) {
        const declaration = type.getSymbolOrThrow().getDeclarations()[0]

        const nestedPaths = this.describeInterface(
          declaration as InterfaceDeclaration,
          prefix + prop.getName() + "/"
        )

        paths = {
          ...paths,
          ...nestedPaths,
        }
      } else {
        console.warn(`Unsupported property type`, {prop: prop.getName(), type: type.getText()})
      }
    }

    return paths
  }

  createDefinitionSchemas() {
    if (!this.typeDefinitions.length) return undefined

    const schemas = {}

    while (this.typeDefinitions.length) {
      const type = this.typeDefinitions[0]
      schemas[this.getTypeReferenceName(type)] = this.schema(type, new TypeMapping(), true)
      this.typeDefinitions.splice(0, 1)
    }

    return schemas
  }
  private operationResponses(method: MethodSignature) {
    const returnType = method.getReturnType()

    const noContent = {"204": {description: "Success"}}

    if (!returnType || returnType.isUndefined()) return noContent

    // should be Promise<smth>, get smth
    const promisedReturn = returnType.getTypeArguments()[0]
    if (promisedReturn.getText() == "void") return noContent

    return {
      "200": {
        description: "Success",
        content: {
          "application/json": {
            schema: this.schema(promisedReturn),
          },
        },
      },
    }
  }

  private requestBody(method: MethodSignature) {
    const params = method.getParameters()
    if (!params.length) return undefined

    return {
      required: !params[0].isOptional(), // TODO also, only if any keys in param type
      content: {
        "application/json": {
          schema: this.schema(params[0].getType()),
        },
      },
    }
  }

  private schema(type: Type, parentTypeMapping = new TypeMapping(), noReference?) {
    if (!type) return {}

    if (type.isArray()) {
      return {
        type: "array",
        items: this.schema(parentTypeMapping.map(type.getArrayType())),
      }
    }

    if (!noReference && this.shouldBeReferenced(type)) {
      this.typeDefinitions.push(type)
      return {
        $ref: `#/components/schemas/${this.getTypeReferenceName(type)}`,
      }
    }

    if (type.isString()) return {type: "string"}
    if (type.isNumber()) return {type: "number"}
    if (type.isBoolean()) return {type: "boolean"}

    if (type.getText() == "any") return {}

    if (type.isObject()) return this.objectSchema(type, parentTypeMapping)
    if (type.isEnum() || type.isEnumLiteral()) return this.enumSchema(type) // isEnumLiteral for enums with a single value
    if (type.isUnion()) return this.unionSchema(type)

    console.warn(`Unsupported type ${type.getText()}`)
    return undefined
  }

  private shouldBeReferenced(type: Type) {
    // generate reference is there's an alias symbol
    if (type.getAliasSymbol()) return true

    // or it is not an anon object or enum
    if (type.isObject() || type.isEnum() || type.isEnumLiteral()) {
      if ((type.getObjectFlags() & ObjectFlags.Anonymous) == 0) return true
    }

    return false
  }

  private objectSchema(type: Type, parentTypeMapping = new TypeMapping()) {
    if (type.getText() == "Date") {
      return {
        type: "string",
        format: "date-time",
      }
    }

    const typeMapping = new TypeMapping(
      type.getTargetType() ? type.getTargetType().getTypeArguments() : [],
      type.getTypeArguments(),
      parentTypeMapping
    )

    // key-value object
    const properties = {}

    for (const prop of type.getProperties()) {
      // case 1: typed value declaration (TODO may be replace with getSymbol.getDeclarations()?)
      if (prop.getValueDeclaration()) {
        const propertySignature = prop.getValueDeclaration() as PropertySignature

        const propertyType = propertySignature.getType()

        if (propertyType) {
          properties[prop.getName()] = {
            ...this.schema(typeMapping.map(propertyType), typeMapping),
          }
        } else {
          console.warn(`Unable to get type for property ${prop.getName()}`)
        }
      } else {
        // console.warn(`Unable to read type for property ${ prop.getName() }`)
        properties[prop.getName()] = {}
      }
    }

    return {
      type: "object",
      properties,
    }
  }

  private enumSchema(type: Type) {
    const declaration = type.getSymbol().getValueDeclaration() as EnumDeclaration

    if (!declaration.getMembers) {
      return {
        type: "string",
        enum: [type.getSymbolOrThrow().getEscapedName()],
      }
    }

    const members = declaration.getMembers()

    return {
      type: "string",
      enum: members.map(m => m.getValue()),
    }
  }

  private unionSchema(type: Type) {
    let unionTypes = type.getUnionTypes()

    // special case - convert union of literals to enum,
    const literalsOnly = !unionTypes.some(type => !type.isLiteral())

    if (literalsOnly) {
      return {
        type: "string",
        enum: Array.from(
          new Set(
            unionTypes.map(type => {
              if (type.isEnumLiteral()) {
                return type.getSymbolOrThrow().getEscapedName()
              }

              return eval(type.getText())
            })
          )
        ),
      }
    }

    return {
      anyOf: unionTypes.map(t => this.schema(t)),
    }
  }

  private getTypeReferenceName(type: Type, skipArguments?): string {
    // Generic
    if (!skipArguments && type.getTypeArguments().length > 0) {
      const targetName = this.getTypeReferenceName(type.getApparentType(), true)

      const argNames = type
        .getTypeArguments()
        .map(type => this.getTypeReferenceName(type))
        .join("And")
      return `${targetName}Of_${argNames}`
    }

    let text = type.getText()

    if (text.indexOf("<") >= 0) text = text.substring(0, text.indexOf("<"))

    const idx = text.lastIndexOf(".")

    const name = text.substring(idx + 1)
    const absolutePathMatch = text.match(/"(.+?)"/)

    if (!absolutePathMatch) {
      return name
    }

    let modulePath = absolutePathMatch[1]
    modulePath = modulePath.replace(/node_modules/g, "lib")

    const referencePath = path.relative(this.baseDir, modulePath).replace(/\//g, ".")
    const referenceName = `${referencePath}.${name}`

    return referenceName
  }

  private typeDefinitions = []
}

class TypeMapping {
  constructor(from: Type[] = [], to: Type[] = [], private parentTypeMapping = null) {
    for (let i = 0; i < from.length; i++) {
      this.mapping[from[i].getText()] = to[i]
    }
  }

  map(from: Type): Type {
    return (
      this.mapping[from.getText()] ||
      (this.parentTypeMapping && this.parentTypeMapping.map(from)) ||
      from
    )
  }

  private mapping: {[name: string]: Type} = {}
}
