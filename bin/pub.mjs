#!/usr/bin/env node

import boxen from 'boxen'
import chokidar from 'chokidar'
import k from 'kleur'
import { lookup } from 'mrmime'
import fs from 'node:fs'
import { createServer } from 'node:http'
import { dirname, resolve } from 'node:path'
import sade from 'sade'
import { compile } from '../lib/publish.mjs'
import { getPkgJSON, size } from '../lib/utils.mjs'

const box = (...args) => console.log(boxen(...args))

const clearLastLine = () => {
    process.stdout.moveCursor(0, -1) // up one line
    process.stdout.clearLine(1) // from cursor to end
}

const program = sade('pub <src> [dest]', true)
    .version(getPkgJSON().version)
    .option('port', 'Port to run the dev server on', '3000')
    .option(
        'base-url',
        'Base URL to use for assets (eg: barelyhuman.github.io/)',
        '/',
    )
    .action(async (src, dest, options) => {
        if (src) {
            console.log(k.gray('Processing...'))
            const compilerOptions = {
                baseUrl: options['base-url'],
            }
            let output = await compile(src, dest, compilerOptions)
            clearLastLine()
            if (!dest) {
                const watchMap = new Set()
                const watcher = chokidar.watch(src)
                watcher.on('all', async (c, f) => {
                    if (c == 'add') {
                        if (watchMap.has(f)) {
                            return
                        }
                        watchMap.add(f)
                    }
                    output = await compile(src, dest, compilerOptions)
                })

                const server = createServer((req, res) => {
                    const path = req.url
                    const end = req.url.split('/').at(-1)
                    let mime = 'text/plain'
                    if (end) {
                        mime = lookup(end)
                    }

                    if (path === '/' && output['/index.html']) {
                        res.setHeader('content-type', 'text/html')
                        return res.end(output['/index.html'].content)
                    }

                    if (output[path]) {
                        res.setHeader('content-type', mime)
                        return res.end(output[path].content)
                    } else {
                        const normalizedHTML =
                            path.replace(/\.html$/, '') + '.html'
                        if (output[normalizedHTML]) {
                            res.setHeader('content-type', 'text/html')
                            return res.end(output[normalizedHTML].content)
                        } else {
                            res.statusCode = 404
                            return res.end('404')
                        }
                    }
                })

                process.on('SIGINT', () => {
                    watcher.close()
                    server.close()
                    process.exit()
                })

                server.listen(options.port, () => {
                    box(
                        `@tinytown/pub (${k.gray(getPkgJSON().version)})
    
> listening on ${k.underline(['http://', options.host ?? 'localhost:', options.port].filter(Boolean).join(''))}`,
                        {
                            borderStyle: 'single',
                            borderColor: 'cyan',
                            padding: 1,
                        },
                    )
                })
            } else {
                const filesWritten = []
                await Promise.all(
                    Object.values(output).map(async (def) => {
                        await fs.promises.mkdir(dirname(def.dist), {
                            recursive: true,
                        })
                        filesWritten.push({
                            dist: resolve(def.dist).replace(process.cwd(), '.'),
                            size: size(def.content.length),
                        })
                        await fs.promises.writeFile(
                            def.dist,
                            def.content,
                            'utf8',
                        )
                    }),
                )
                box(
                    `@tinytown/pub (${k.gray(getPkgJSON().version)})

${' '.repeat(4) + filesWritten.map((d) => `${k.cyan(d.size)} ${k.gray(d.dist)}`).join('\n' + ' '.repeat(4))}

${k.green('✓')} ${k.gray('Built to')} ${k.green(resolve(dest).replace(process.cwd(), '.'))}`,
                    {
                        borderStyle: 'none',
                    },
                )
            }
        }
    })
    .example(`pub ./src`)
    .example(`pub ./src ./dist`)

program.parse(process.argv)
