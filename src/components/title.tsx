import { cn } from "@/lib/utils"

type Props = {
  title: string
  type: string
  route: string
}

export function TitleComponent({ title, type, route }: Props) {
  if (type === "separator") {
    if (title.startsWith("1- ")) {
      console.log(title, type, route)
      const titleWithoutPrefix = title.slice(3)
      return (
        <h1
          className={cn(
            "text-center text-xl font-bold text-gray-900 underline underline-offset-8 dark:text-gray-100 lg:text-2xl"
          )}
        >
          {titleWithoutPrefix}
        </h1>
      )
    }
  }

  return title
}
