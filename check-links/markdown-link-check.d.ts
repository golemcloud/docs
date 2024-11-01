declare module "markdown-link-check" {
  export interface HttpHeader {
    urls: string[]
    headers: Record<string, string>
  }

  export interface IgnorePattern {
    pattern: RegExp | string
  }

  export interface ReplacementPattern {
    pattern: RegExp | string
    replacement: string
    global?: boolean
  }

  export interface Options {
    ignoreDisable?: boolean
    showProgressBar?: boolean
    ignorePatterns?: IgnorePattern[]
    replacementPatterns?: ReplacementPattern[]
    httpHeaders?: HttpHeader[]
    baseUrl?: string
    projectBaseUrl?: string
    headers?: Record<string, string>
  }

  export interface LinkCheckResult {
    link: string
    status: "alive" | "dead" | "ignored" | "error"
    statusCode: number
    err?: Error
  }

  function markdownLinkCheck(
    markdown: string,
    opts: Options,
    callback: (error: Error | null, results: LinkCheckResult[]) => void
  ): void
  function markdownLinkCheck(
    markdown: string,
    callback: (error: Error | null, results: LinkCheckResult[]) => void
  ): void

  export default markdownLinkCheck
}
