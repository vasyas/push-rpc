import * as path from "path"
import {
  EnumDeclaration,
  JSDocableNode,
  ObjectFlags,
  PropertySignature,
  Type,
  TypeElementMemberedNode,
} from "ts-morph"

export class ApiDescriber {
  constructor(private baseDir: string, private skipPrefix?: string) {}

  describeEntryType(type: TypeElementMemberedNode, prefix = "/"): any {
    if (this.skipPrefix && prefix.startsWith(this.skipPrefix)) {
      return {}
    }

    let paths = {}

    for (const method of type.getMethods()) {
      const params = method.getParameters()
      const requestType = params.length && params[0].getType()

      const comment = method
        .getJsDocs()
        .map(d => d.getInnerText())
        .join("\n")

      // should be Promise<smth>, get smth
      const returnType =
        method.getReturnType().getTypeArguments().length &&
        method.getReturnType().getTypeArguments()[0]

      paths[prefix + method.getName()] = {
        post: {
          summary: `Method ${method.getName()}`,
          description: comment || undefined,
          requestBody: this.requestBody(requestType, requestType && !params[0].isOptional()),
          responses: this.operationResponses(returnType),
        },
      }
    }

    for (const prop of type.getProperties()) {
      const type = prop.getTypeNodeOrThrow().getType()

      if (type.getSymbol().getName() == "Topic") {
        const responseType = type.getTypeArguments()[0]
        const requestType = type.getTypeArguments()[1]

        const comment = prop
          .getJsDocs()
          .map(d => d.getInnerText())
          .join("\n")

        paths[prefix + prop.getName()] = {
          put: {
            summary: `Topic ${prop.getName()}`,
            description: comment || undefined,
            requestBody: this.requestBody(requestType, true),
            responses: this.operationResponses(responseType),
          },
        }
      } else if (type.isInterface() || type.isObject()) {
        const declaration = type.getSymbolOrThrow().getDeclarations()[0]

        const nestedPaths = this.describeEntryType(
          (declaration as unknown) as TypeElementMemberedNode,
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

  private operationResponses(returnType) {
    const noContent = {"204": {description: "Success"}}

    if (!returnType || returnType.getText() == "void") return noContent

    return {
      "200": {
        description: "Success",
        content: {
          "application/json": {
            schema: this.schema(returnType),
          },
        },
      },
    }
  }

  private requestBody(type, required) {
    if (!type) return undefined

    return {
      required,
      content: {
        "application/json": {
          schema: this.schema(type),
        },
      },
    }
  }

  private schema(type: Type, parentTypeMapping = new TypeMapping(), noReference?) {
    if (!type) return {}

    if (type.isArray()) {
      return {
        type: "array",
        items: this.schema(parentTypeMapping.map(type.getArrayElementType())),
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

    if (type.isObject() || type.isIntersection()) return this.objectSchema(type, parentTypeMapping)
    if (type.isEnum() || type.isEnumLiteral()) return this.enumSchema(type) // isEnumLiteral for enums with a single value
    if (type.isUnion()) return this.unionSchema(type)

    if (type.isTypeParameter()) {
      const t = type.getTypeArguments()
      console.log(t)
    }

    console.warn(`Unsupported type ${type.getText()}`)
    return {}
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

    const typeMapping = new TypeMapping(parentTypeMapping)

    if (type.getTargetType()) {
      for (let i = 0; i < type.getTargetType().getTypeArguments().length; i++) {
        typeMapping.add(type.getTargetType().getTypeArguments()[i], type.getTypeArguments()[i])
      }

      for (let i = 0; i < type.getTargetType().getAliasTypeArguments().length; i++) {
        typeMapping.add(
          type.getTargetType().getAliasTypeArguments()[i],
          type.getAliasTypeArguments()[i]
        )
      }
    }

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

          const comment = propertySignature
            .getJsDocs()
            .map(d => d.getInnerText())
            .join("\n")

          properties[prop.getName()].description = comment || undefined
        } else {
          console.warn(`Unable to get type for property ${prop.getName()}`)
        }
      } else {
        // console.warn(`Unable to read type for property ${prop.getName()}`)
        properties[prop.getName()] = {}
      }
    }

    const targetSymbol = type.getAliasSymbol() || type.getSymbol()
    const declarations = targetSymbol?.getDeclarations?.() || []

    const declaration = (declarations?.[0] as unknown) as JSDocableNode
    const comment = (declaration?.getJsDocs?.() || []).map(d => d.getInnerText()).join("\n")

    return {
      type: "object",
      description: comment || undefined,
      properties,
    }
  }

  private enumSchema(type: Type) {
    const declaration = type.getSymbol().getValueDeclaration() as EnumDeclaration

    const comment = (declaration?.getJsDocs?.() || []).map(d => d.getInnerText()).join("\n")

    if (!declaration.getMembers) {
      return {
        type: "string",
        description: comment || undefined,
        enum: [type.getSymbolOrThrow().getEscapedName()],
      }
    }

    const members = declaration.getMembers()

    return {
      type: "string",
      description: comment || undefined,
      enum: members.map(m => m.getValue()),
    }
  }

  private unionSchema(type: Type) {
    let unionTypes = type.getUnionTypes()

    // special case - convert union of literals to enum,
    const literalsOnly = !unionTypes.some(type => !type.isLiteral())

    const targetSymbol = type.getAliasSymbol() || type.getSymbol()
    const declarations = targetSymbol?.getDeclarations?.() || []
    const declaration = (declarations?.[0] as unknown) as JSDocableNode
    const comment = (declaration?.getJsDocs?.() || []).map(d => d.getInnerText()).join("\n")

    if (literalsOnly) {
      return {
        type: "string",
        description: comment || undefined,
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
      description: comment || undefined,
    }
  }

  private getTypeReferenceName(type: Type, skipArguments?): string {
    // Generic
    const typeArguments =
      type.getTypeArguments().length > 0 ? type.getTypeArguments() : type.getAliasTypeArguments()

    if (!skipArguments && typeArguments.length > 0) {
      const targetName = this.getTypeReferenceName(type.getApparentType(), true)

      const argNames = typeArguments.map(type => this.getTypeReferenceName(type)).join("And")
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
  constructor(private parentTypeMapping = null) {}

  add(from: Type, to: Type) {
    this.mapping[from.getText()] = to
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
