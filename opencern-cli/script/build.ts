#!/usr/bin/env bun

import path from "path"
import solidPlugin from "@opentui/solid/bun-plugin"

const dir = path.resolve(import.meta.dir, "..")
process.chdir(dir)

const outfile = process.argv[2] || "opencern"

await Bun.build({
  plugins: [solidPlugin],
  compile: {
    autoloadBunfig: false,
    outfile,
  },
  entrypoints: ["./bin/opencern.js"],
})

console.log(`Built: ${outfile}`)
