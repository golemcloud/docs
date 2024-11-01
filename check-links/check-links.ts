import { glob } from "glob"
import path from "path"
import { promises as fs } from "fs"

import markdownLinkCheck, { LinkCheckResult } from "markdown-link-check"

const projectBaseUrl = (() =>
  `file://${
    process.platform === "win32" ? "/" + process.cwd().replace(/\\/g, "/") : process.cwd()
  }`)()

// Replace links starting with /docs/ with the full path.
const docsPrefixPattern = {
  pattern: "^/docs/",
  replacement: `${projectBaseUrl}/src/pages/docs/`,
} as const

const makeBaseUrl = (file: string) =>
  `file://${
    process.platform === "win32"
      ? "/" + path.dirname(path.resolve(file)).replace(/\\/g, "/")
      : path.dirname(path.resolve(file))
  }`

const execute = async (files: string[]) => {
  const markdownFiles = files.filter(file => file.endsWith(".mdx") || file.endsWith(".md"))
  console.log(`Checking links in ${markdownFiles.length} files`)

  type CheckFileResult =
    | {
        type: "success"
      }
    | {
        type: "dead-links"
        file: string
        deadLinks: LinkCheckResult[]
      }
    | {
        type: "fatal"
        file: string
        error: Error
      }

  const checkFile = async (fileStr: string): Promise<CheckFileResult> => {
    try {
      const result = await new Promise<CheckFileResult>(async resolve => {
        const file = await fs.readFile(fileStr, "utf8")

        const baseUrl = makeBaseUrl(fileStr)

        markdownLinkCheck(
          file,
          {
            baseUrl,
            projectBaseUrl,
            ignorePatterns: [{ pattern: "^https?://" }],
            showProgressBar: false,
            replacementPatterns: [docsPrefixPattern],
          },
          (err, results) => {
            if (err) {
              resolve({ type: "fatal", file: fileStr, error: err })
            } else {
              const deadLinks = results.filter(
                result => result.status === "dead" || result.status === "error"
              )
              if (deadLinks.length > 0) {
                resolve({ type: "dead-links", file: fileStr, deadLinks })
              } else {
                resolve({ type: "success" })
              }
            }
          }
        )
      })
      return result
    } catch (err) {
      return { type: "fatal", file: fileStr, error: err as Error }
    }
  }

  const errors = (await Promise.all(markdownFiles.map(checkFile))).filter(
    result => result.type !== "success"
  ) as CheckFileResult[]

  if (errors.length > 0) {
    console.error(`\nFound ${errors.length} broken links:`)
    errors.forEach(error => {
      switch (error.type) {
        case "dead-links":
          console.error(`- ${error.file}:`)
          error.deadLinks.forEach(link => {
            const cleanLink = link.link.replace(docsPrefixPattern.replacement, "/docs/")
            console.error(`  - ${cleanLink} (${link.status})`)
          })
          break
        case "fatal":
          console.error(`- ${error.file}: ${error.error.message}`)
          break
      }
    })
    process.exit(1)
  }
}

const main = async () => {
  const args = process.argv.slice(2)
  const files = args.length > 0 ? args : await glob("**/*.{mdx,md}", { ignore: "node_modules/**" })
  await execute(files)
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("Failed to check links:", err)
    process.exit(1)
  })
