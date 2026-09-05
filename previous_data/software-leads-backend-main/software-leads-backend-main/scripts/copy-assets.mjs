import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs'
import { join, dirname } from 'path'

// tsc only emits .js files. Copy non-TS assets (e.g. .css) from src/ to dist/
// so runtime readFileSync(__dirname/...) paths resolve in the build output.
const SRC = 'src'
const DIST = 'dist'
const ASSET_EXTENSIONS = ['.css', '.html']

function copyAssets(dir) {
    for (const entry of readdirSync(dir)) {
        const srcPath = join(dir, entry)
        if (statSync(srcPath).isDirectory()) {
            copyAssets(srcPath)
            continue
        }
        if (!ASSET_EXTENSIONS.some((ext) => entry.endsWith(ext))) continue
        const destPath = srcPath.replace(SRC, DIST)
        mkdirSync(dirname(destPath), { recursive: true })
        cpSync(srcPath, destPath)
        console.log(`copied ${srcPath} -> ${destPath}`)
    }
}

if (!existsSync(SRC)) {
    console.error(`source directory "${SRC}" not found`)
    process.exit(1)
}
copyAssets(SRC)
