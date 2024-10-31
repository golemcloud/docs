const glob = require("glob")
const { exec } = require("child_process")

glob("**/*.mdx", (err, files) => {
  if (err) {
    console.error("Error finding files:", err)
    process.exit(1)
  }

  files.forEach(file => {
    exec(`markdown-link-check ${file} --quiet`, (err, stdout, stderr) => {
      if (err) {
        console.error(`Error checking links in ${file}:`, stderr || stdout)
        process.exit(1) // Fail the script if any file has broken links
      } else {
        console.log(`Checked links in ${file}:`, stdout)
      }
    })
  })
})
