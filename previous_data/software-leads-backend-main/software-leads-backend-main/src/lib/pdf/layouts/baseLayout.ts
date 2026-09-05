import path from 'path'
import fs   from 'fs'

export const renderBaseLayout = (
    title:   string,
    content: string
): string => {

    // Try to read CSS file, fallback to empty string
    let css = ''
    try {
        const cssPath = path.join(__dirname, '..', 'styles', 'estimation.css')
        css = fs.readFileSync(cssPath, 'utf-8')
    } catch {
        // CSS file not found — try src path (dev fallback)
        try {
            const srcPath = path.join(process.cwd(), 'src', 'lib', 'pdf', 'styles', 'estimation.css')
            css = fs.readFileSync(srcPath, 'utf-8')
        } catch {
            console.warn('estimation.css not found')
        }
    }

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${title}</title>
    <style>${css}</style>
</head>
<body>
    ${content}
</body>
</html>
    `
}