#!/usr/bin/env node

import boxen from 'boxen'
import { lookup } from 'mrmime'
import fs from 'node:fs'
import { createServer } from 'node:http'
import { dirname, resolve } from 'node:path'
import sade from 'sade'
import { compile } from '../lib/publish.mjs'

const box = (...args) => console.log(boxen(...args))

const program = sade('pub <src> [dest]', true)
    .action(async (src, dest, options) => {
        if (src) {
            const output = await compile(src, dest, {})
            if (!dest) {
                createServer((req, res) => {
                    const path = req.url
                    console.log({
                        k: Object.keys(output),
                        path,
                        op: output[path],
                    })
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
                }).listen(3000, () => {
                    box(
                        `Pub Dev Server                
    
    > listening on 3000`,
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
                        filesWritten.push(
                            resolve(def.dist).replace(process.cwd(), ''),
                        )
                        await fs.promises.writeFile(
                            def.dist,
                            def.content,
                            'utf8',
                        )
                    }),
                )
                box(
                    `
Built!

${' '.repeat(4) + filesWritten.map((d) => d).join('\n' + ' '.repeat(4))}
                `,
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
