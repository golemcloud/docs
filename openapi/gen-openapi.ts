import SwaggerParser from "@apidevtools/swagger-parser"
import type { JSONSchema7 } from "json-schema"
import { writeFile } from "fs/promises"
import { OpenAPIV3 } from "openapi-types"
import OpenAPISampler from "openapi-sampler"

const SPEC_SRC = "./openapi/cloud-spec.yaml"
const GEN_PATH = "./src/pages/docs/rest-api"

async function main() {
  const api = (await SwaggerParser.parse(SPEC_SRC)) as OpenAPIV3.Document

  const tags = api.tags

  if (!tags) {
    throw new Error("No tags")
  }

  const apiItems = extractApiItems(api)

  const grouped = groupBy(apiItems, item => {
    const tagId = item.operation.tags?.at(0)
    if (!tagId) {
      throw new Error("No tag")
    }

    const foundTag = tags.find(tag => tag.name === tagId)

    if (!foundTag) {
      throw new Error("Invalid Tag")
    }

    return foundTag
  })

  const markdown = Array.from(grouped.entries())
    .filter(([tag, _]) => tag.name !== "HealthCheck")
    .map(([tag, items]) => {
      return [tag, convertToMarkdown(api, tag, items)] as const
    })

  await Promise.all(
    markdown.map(([tag, content]) => {
      const fileName = pascalToKebab(tag.name)
      const path = `${GEN_PATH}/${fileName}.mdx`
      writeFile(path, content)
    })
  )

  console.log("Finished Writing docs")
}

type ApiItem = {
  path: string
  method: string
  operation: OpenAPIV3.OperationObject
}

function extractApiItems(api: OpenAPIV3.Document): ApiItem[] {
  return Object.entries(api.paths)
    .filter(([path, _]) => !path.includes("admin"))
    .filter(([_, pathItem]) => pathItem !== undefined)
    .flatMap(([path, pathItem]) =>
      Object.entries(pathItem!).map(([method, operation]) => {
        return {
          path,
          method,
          operation: operation as OpenAPIV3.OperationObject,
        }
      })
    )
}

function convertToMarkdown(
  api: OpenAPIV3.Document,
  tag: OpenAPIV3.TagObject,
  apiItems: ApiItem[]
): string {
  const title = pascalToSpace(tag.name)

  const itemsMarkdown = apiItems.map(i => convertItemToMarkdown(api, i)).join("\n\n")

  const errors = makeRequestError(api, apiItems[0].operation)

  const errorTitle = errors ? `## ${title} API Errors` : ""
  const errorsContent = errors ? errors : ""
  const errorSection = errors ? `${errorTitle}\n${errorsContent}` : ""

  return [`# ${title} API`, tag.description, itemsMarkdown, errorSection].join("\n")
}

function convertItemToMarkdown(
  api: OpenAPIV3.Document,
  { path, method, operation }: ApiItem
): string {
  const overviewTable = makeMarkdownTable({
    headers: ["Path", "Method", "Protected"],
    rows: [[`\`${path}\``, method.toUpperCase(), operation.security === undefined ? "No" : "Yes"]],
  })

  const queryParams = (operation.parameters?.filter(
    param => !!param && "in" in param && param.in === "query"
  ) ?? []) as OpenAPIV3.ParameterObject[]

  const queryParamsTable = makeQueryParamTable(queryParams)

  const explanation = operation.description === undefined ? "" : operation.description

  const requestBody = makeRequestBody(api, operation)

  const response = makeResponseType(api, operation)

  return [
    `## ${operation.summary}`,
    overviewTable,
    "",
    explanation,
    "",
    queryParamsTable,
    "",
    requestBody,
    response,
  ].join("\n")
}

type MdTable = {
  headers: string[]
  rows: string[][]
}

function makeMarkdownTable(table: MdTable) {
  const header = table.headers.join("|")
  const headerLine = table.headers.map(_ => "---").join("|")
  const rows = table.rows.map(row => row.join("|")).join("\n")

  return `${header}\n${headerLine}\n${rows}`
}

function makeQueryParamTable(queryParams: OpenAPIV3.ParameterObject[]) {
  if (queryParams.length > 0) {
    const rows = queryParams.map(param => {
      const schema = param?.schema
      if (!schema) {
        throw new Error(`No schema ${JSON.stringify(param)}}`)
      }

      const type = (
        "type" in schema ? schema.type : "$ref" in schema ? schema.$ref : schema
      ) as string

      const description = param.description ?? "-"
      const required = param.required ? "Yes" : "No"

      return [param.name, type, required, description]
    })
    const table = makeMarkdownTable({
      headers: ["Name", "Type", "Required", "Description"],
      rows,
    })

    return `**Query Parameters**\n\n${table}`
  } else {
    return ""
  }
}

function makeResponseType(api: OpenAPIV3.Document, operation: OpenAPIV3.OperationObject) {
  const response = (() => {
    const response = operation.responses["200"]
    if (!response || !("content" in response)) {
      throw new Error("No Success Response")
    }
    const responseSchema = response.content?.["application/json; charset=utf-8"]?.schema

    if (responseSchema === undefined) {
      return undefined
    } else {
      const sample = OpenAPISampler.sample(responseSchema as JSONSchema7, undefined, api)
      return sample as Record<string, unknown>
    }
  })()

  if (!response) {
    return ""
  } else {
    return [
      `**Example Response JSON**`,
      "",
      "```json copy",
      JSON.stringify(response, null, 2),
      "```",
    ].join("\n")
  }
}

function makeRequestBody(api: OpenAPIV3.Document, operation: OpenAPIV3.OperationObject) {
  const requestBody = operation.requestBody
  if (requestBody === undefined) {
    return ""
  } else {
    const content = "content" in requestBody ? requestBody?.content : undefined
    if (!content) {
      return ""
    } else {
      const jsonSchema = content["application/json; charset=utf-8"]?.schema

      if (jsonSchema === undefined) {
        return ""
      } else {
        const sample = OpenAPISampler.sample(jsonSchema as JSONSchema7, undefined, api)
        return [
          `**Example Request JSON**`,
          "```json copy",
          JSON.stringify(sample, null, 2),
          "```",
        ].join("\n")
      }
    }
  }
}

function makeRequestError(api: OpenAPIV3.Document, operation: OpenAPIV3.OperationObject) {
  const errorResponses = Object.entries(operation.responses)
    .filter(([code, _]) => code !== "200")
    .map(([status, response]) => {
      if ("content" in response) {
        const schema = response.content?.["application/json; charset=utf-8"]?.schema
        if (schema) {
          return { status, desc: response.description, schema }
        }
      }
      return undefined
    })
    .filter(resp => resp !== undefined)
    .map(resp => resp!)
    .map(({ status, desc, schema }) => {
      const sample = OpenAPISampler.sample(schema as JSONSchema7, undefined, api)

      const jsonRendered = ["`", JSON.stringify(sample), "`"].join("")

      const shortedDesc = desc?.split("\n").join(" ")

      return [status, shortedDesc, jsonRendered]
    })

  if (errorResponses.length === 0) {
    return undefined
  }

  return makeMarkdownTable({
    headers: ["Status Code", "Description", "Body"],
    rows: errorResponses,
  })
}

function groupBy<T, K>(items: T[], keySelector: (item: T) => K): Map<K, [T]> {
  const map = new Map<K, [T]>()
  items.forEach(item => {
    const key = keySelector(item)
    const existing = map.get(key)
    if (existing) {
      existing.push(item)
    } else {
      map.set(key, [item])
    }
  })

  return map
}

function pascalToKebab(str: string) {
  return str.replace(/([a-z0-9])(?=[A-Z])/g, "$1-").toLowerCase()
}

function pascalToSpace(str: string) {
  return str.replace(/([a-z])([A-Z])/g, "$1 $2")
}

main().catch(e => console.error(e))
