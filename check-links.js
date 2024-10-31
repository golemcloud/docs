const glob = require("glob")
const { exec } = require("child_process")

glob("**/js-language-guide/defining-components.mdx", (err, files) => {
  if (err) {
    console.error("Error finding files:", err)
    process.exit(1)
  }

  files.forEach(file => {
    exec(`markdown-link-check ${file}`, (err, stdout, stderr) => {
      if (err) {
        console.error(`Error checking links in ${file}:`, stderr || stdout)
        process.exit(1)
      } else {
        console.log(`Checked links in ${file}:`, stdout)
      }
    })
  })
})
