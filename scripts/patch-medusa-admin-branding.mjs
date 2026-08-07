import fs from "node:fs"
import path from "node:path"

const replacements = new Map([
  ["Medusa Admin", "ZEDX Admin"],
  ["Medusa Cloud", "ZEDX Cloud"],
  ["Medusa API", "ZEDX API"],
  ["Medusa application", "ZEDX application"],
  ["Medusa client", "ZEDX client"],
  ['displayName = "Medusa"', 'displayName = "ZEDX"'],
  ["Welcome to Medusa", "Welcome to ZEDX"],
  ["Welcome to ZEDX", "Welcome to ZEDX"],
  ["Sign in to access the account area", "Sign in to access the ZEDX admin area"],
  ["medusa-recovery-codes.txt", "zedx-recovery-codes.txt"],
])

const logoPath =
  "/Users/abduljawadkt/Desktop/tech projects/zedx/public/brand/zedx-logo-white.png"
const logoDataUri = fs.existsSync(logoPath)
  ? `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}`
  : ""

const files = [
  "node_modules/@medusajs/dashboard/src/components/common/logo-box/avatar-box.tsx",
  "node_modules/@medusajs/dashboard/src/hooks/use-document-title.tsx",
  "node_modules/@medusajs/dashboard/src/routes/products/product-import/helpers/import-template.ts",
]

const dashboardSrcDir = "node_modules/@medusajs/dashboard/src"
const dashboardDistDir = "node_modules/@medusajs/dashboard/dist"
const viteCacheDir = "apps/backend/node_modules/.vite/deps"
const translationDir = "node_modules/@medusajs/dashboard/src/i18n/translations"

function addFiles(dir, matcher) {
  if (!fs.existsSync(dir)) {
    return
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const next = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      addFiles(next, matcher)
      continue
    }

    if (matcher(entry.name, next)) {
      files.push(next)
    }
  }
}

function addViteCacheFiles(dir) {
  addFiles(dir, (name) => /\.(js|mjs|json)$/.test(name))
}

addFiles(dashboardSrcDir, (name) => /\.(js|ts|tsx|json)$/.test(name))
addFiles(translationDir, (name) => /\.json$/.test(name))
addFiles(dashboardDistDir, (name) => /\.(js|mjs|json)$/.test(name))
addViteCacheFiles(viteCacheDir)

function patchLogo(content) {
  if (!logoDataUri) {
    return content
  }

  const sourceLogo = `      <img
        alt="ZEDX"
        className="relative z-10 h-7 w-20 max-w-none object-contain"
        src="${logoDataUri}"
      />`

  const compiledLogo = (runtime) =>
    `        /* @__PURE__ */ (0, ${runtime}.jsx)("img", { alt: "ZEDX", className: "relative z-10 h-7 w-20 max-w-none object-contain", src: "${logoDataUri}" })
      ]`

  const directCompiledLogo = () =>
    `        /* @__PURE__ */ jsx("img", { alt: "ZEDX", className: "relative z-10 h-7 w-20 max-w-none object-contain", src: "${logoDataUri}" })
      ]`

  content = content.replace(
    /      <svg\n        className="rounded-\[10px\]"[\s\S]*?      <\/svg>/g,
    sourceLogo
  )

  content = content.replace(
    /        \/\* @__PURE__ \*\/ \(0, ([A-Za-z0-9_$]+)\.jsxs\)\(\n          "svg",\n          \{\n            className: "rounded-\[10px\]",[\s\S]*?\n          \}\n        \)\n      \]/g,
    (_, runtime) => compiledLogo(runtime)
  )

  content = content.replace(
    /        \(0, ([A-Za-z0-9_$]+)\.jsxs\)\(\n          "svg",\n          \{\n            className: "rounded-\[10px\]",[\s\S]*?\n          \}\n        \)\n      \]/g,
    (_, runtime) => compiledLogo(runtime)
  )

  content = content.replace(
    /        \/\* @__PURE__ \*\/ jsxs\(\n          "svg",\n          \{\n            className: "rounded-\[10px\]",[\s\S]*?\n          \}\n        \)\n      \]/g,
    () => directCompiledLogo()
  )

  return content
}

function canSafelyReplaceBrandWord(content) {
  return !/\b(import|var|const|let|function|class) Medusa\b|\bMedusa\s*=|\bnew Medusa\b/.test(
    content
  )
}

function patchBrandText(content) {
  if (!canSafelyReplaceBrandWord(content)) {
    return content
  }

  return content.replaceAll("Medusa", "ZEDX")
}

for (const file of files) {
  const target = path.resolve(file)

  if (!fs.existsSync(target)) {
    console.warn(`Skipped missing file: ${file}`)
    continue
  }

  let content = fs.readFileSync(target, "utf8")
  const original = content
  for (const [from, to] of replacements) {
    content = content.replaceAll(from, to)
  }
  content = patchBrandText(content)
  content = patchLogo(content)

  if (content === original) {
    continue
  }

  fs.writeFileSync(target, content)
  console.log(`Patched ${file}`)
}
