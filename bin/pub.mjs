#!/usr/bin/env node

import boxen from 'boxen'
import chokidar from 'chokidar'
import k from 'kleur'
import { lookup } from 'mrmime'
import fs from 'node:fs'
import { access, readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { dirname, resolve, sep } from 'node:path'
import { join } from 'path'
import readline from 'readline'
import sade from 'sade'
import glob from 'tiny-glob'
import { SUPPORTED_EXTENSIONS, compile } from '../lib/publish.mjs'
import { getNetwork, getPkgJSON, size } from '../lib/utils.mjs'

const box = (...args) => console.log(boxen(...args))

const SUPPORTED_FILES_GLOB = `**/*.{${SUPPORTED_EXTENSIONS.map((d) => d.replace(/^\./, '')).join(',')}}`
const pad = (msg) => msg.padEnd(4, ' ')

const clearLastLine = () => {
    readline.cursorTo(process.stdout, 0, -1)
    readline.clearScreenDown(process.stdout)
}

const readConfig = async (path) => {
    const exists = await access(path)
        .then((_) => {
            return true
        })
        .catch((err) => {
            return false
        })

    if (exists) {
        const d = await readFile(path, 'utf8')
        try {
            return JSON.parse(d)
        } catch (err) {
            throw new Error(`Error parsing the config file properly, ${path}`)
        }
    }
    return {}
}

const program = sade('pub <src> [dest]', true)
    .version(getPkgJSON().version)
    .option('port', 'Port to run the dev server on', '3000')
    .option(
        'base-url',
        'Base URL to use for assets (eg: barelyhuman.github.io/)',
        '/',
    )
    .option('config', 'config file for pub', './_pub.json')
    .action(async (src, dest, options) => {
        const config = await readConfig(options.config)
        if (src) {
            console.log(k.gray('Processing...'))
            const compilerOptions = {
                baseUrl: options['base-url'],
                jsxImportSource: config.jsxImportSource,
            }

            let output = await compile(src, dest, compilerOptions)
            clearLastLine()
            if (!dest) {
                const supportedFiles = await glob(SUPPORTED_FILES_GLOB, {
                    filesOnly: true,
                    cwd: join(process.cwd(), src),
                    absolute: false,
                })

                const maxDepthToWatch = supportedFiles.reduce((acc, item) => {
                    return Math.max(acc, item.split(sep).length)
                }, 1)

                const watchMap = new Set()
                const watcher = chokidar.watch(src, {
                    depth: maxDepthToWatch,
                    ignored: (f) => {
                        return f.startsWith('node_modules')
                    },
                })
                watcher.add('_pub.json')
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

                server.listen(options.port, async () => {
                    box(
                        `@tinytown/pub (${k.gray(getPkgJSON().version)})

${k.green('Serving')}


  Local:${pad('')}${k.underline(['http://', options.host ?? 'localhost:', options.port].filter(Boolean).join(''))}
Network:${pad('')}${k.underline(['http://', getNetwork() + ':', options.port].filter(Boolean).join(''))}
    `,
                        {
                            borderStyle: 'single',
                            borderColor: 'cyan',
                            padding: 1,
                        },
                    )
                })
            } else {
                const filesWritten = []
                await Promise.allSettled(
                    Object.values(output).map(async (def) => {
                        if (!def.dist) return
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
                process.exit()
            }
        }
    })
    .example(`pub ./src`)
    .example(`pub ./src ./dist`)

program.parse(process.argv)
