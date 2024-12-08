import { djb2 as hash } from '@dumbjs/quick-hash/djb2'
import { build } from 'esbuild'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { htmlProcessor } from '../processors/htmlProcessor.mjs'
import { readFile } from 'node:fs/promises'
import { cssTransformer } from './cssTransformer.mjs'

export const svelteTransformer = (options) => ({
    transform: async (code, file) => {
        const baseFilePath = relative(process.cwd(), file)
        const tempFilePath = baseFilePath.replace(extname(baseFilePath), '.mjs')
        const tempFilePathOutput = join('.tmp', tempFilePath)
        const cssMap = new Map()
        const hashedId = hash(code)
        const tempFilePathContents = `
import Component from "${file}?${hashedId}"
import {render} from "svelte/server"

export const prerender = () => render(Component)
        `

        const sveltePlugin = buildSveltePlugin({
            cssMap,
            sourceFile: resolve(tempFilePathOutput),
        })

        const scriptId = `pub-script-${hashedId}`
        const styleId = `pub-styles-${hashedId}`

        await build({
            stdin: {
                contents: tempFilePathContents,
                resolveDir: process.cwd(),
                sourcefile: tempFilePathOutput,
            },
            bundle: true,
            format: 'esm',
            outExtension: {
                '.js': '.mjs',
            },
            minify: true,
            external: ['svelte'],
            outfile: tempFilePathOutput,
            allowOverwrite: true,
            treeShaking: true,
            platform: 'node',
            write: true,
            plugins: [sveltePlugin({ mode: 'server' })],
        })

        const clientBuildResult = await build({
            stdin: {
                contents: `
                    import Component from "${file}"
                    import {hydrate} from "svelte"
                    const script = document.getElementById("${scriptId}")
                    if(script){
                        const currentParent = script.parentNode
                        script.parentNode.removeChild(script);
                        document.body.appendChild(script)
                        hydrate(Component, {
                            target: currentParent
                        })
                    }
                `,
                resolveDir: process.cwd(),
                sourcefile: tempFilePathOutput,
            },
            bundle: true,
            format: 'esm',
            outExtension: {
                '.js': '.mjs',
            },
            minify: true,
            treeShaking: true,
            platform: 'browser',
            write: false,
            plugins: [sveltePlugin({ mode: 'client' })],
        })

        const outFile = clientBuildResult.outputFiles.find(
            (d) => d.path === '<stdout>',
        )
        const outputCode = Buffer.from(outFile.contents).toString('utf8')
        const versionHash = hash(outputCode)
        const outputModule = await import(
            resolve(tempFilePathOutput) + `?v=${versionHash}`
        )
        const { body, head } = outputModule.prerender()

        if (outFile) {
            const withStyles = await [...cssMap].reduce(async (acc, item) => {
                const file = item[0]
                const code = item[1]
                const processedCode = await cssTransformer().transform(
                    code,
                    item[0],
                )
                return acc.then(
                    (d) =>
                        d +
                        `/*${file}*/
${processedCode}\n`,
                )
            }, Promise.resolve(``))
            const html = options.layoutTemplate({
                head: `
                    <style id=${styleId}>
                        ${withStyles}
                    </style>
                    ${head}
                `,
                content: `
                ${body}
                <script id="${scriptId}" type="module">
                ${outputCode}
            </script>`,
            })
            return await htmlProcessor(html, options)
        }
        return code
    },
    ext: '.html',
})

function buildSveltePlugin({ sourceFile = '', cssMap = new Map() }) {
    return function sveltePlugin({ mode = 'server' } = {}) {
        /**@type {import("esbuild").Plugin}*/
        return {
            name: 'svelte-render',
            async setup(builder) {
                const svelteCompiler = await import('svelte/compiler')
                const { compile } = svelteCompiler

                builder.onResolve({ filter: /\.svelte$/ }, (args) => {
                    if (args.importer == sourceFile) {
                        return {
                            path: args.path,
                        }
                    }
                    return {
                        path: resolve(join(dirname(args.importer), args.path)),
                    }
                })

                builder.onLoad({ filter: /\.svelte$/ }, async (args) => {
                    const source = await readFile(args.path, 'utf8')
                    const code = compile(source, {
                        generate: mode ?? 'server',
                    })

                    if (code.css?.code) {
                        cssMap.set(
                            relative(process.cwd(), args.path),
                            code.css.code,
                        )
                    }

                    return {
                        contents: code.js.code,
                        loader: 'jsx',
                    }
                })
            },
        }
    }
}
