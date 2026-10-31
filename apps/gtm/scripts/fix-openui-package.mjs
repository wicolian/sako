import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const packageRoot = path.resolve(process.cwd(), 'node_modules/@openuidev/react-lang/dist')

const bridges = [
  ['context', 'export * from "./context.js";\n'],
  ['library', 'export * from "./library.js";\n'],
  ['Renderer', 'export * from "./Renderer.js";\n'],
  ['hooks/useOpenUIState', 'export * from "./useOpenUIState.js";\n'],
  ['hooks/useFormValidation', 'export * from "./useFormValidation.js";\n'],
  ['parser/index', 'export * from "./index.js";\n'],
  ['parser/parser', 'export * from "./parser.js";\n'],
  ['parser/prompt', 'export * from "./prompt.js";\n'],
  ['parser/types', 'export * from "./types.js";\n'],
  ['utils/validation', 'export * from "./validation.js";\n'],
]

async function main() {
  for (const [relativePath, contents] of bridges) {
    const filePath = path.join(packageRoot, relativePath)
    await mkdir(path.dirname(filePath), { recursive: true })
    await writeFile(filePath, contents, 'utf8')
  }
}

main().catch((error) => {
  console.error('Failed to apply OpenUI package fix:', error)
  process.exit(1)
})
