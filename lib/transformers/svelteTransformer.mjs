import { djb2 as hash } from '@dumbjs/quick-hash/djb2'
import { build } from 'esbuild'
import { extname, join, relative, resolve } from 'node:path'
import { htmlProcessor } from '../processors/htmlProcessor.mjs'

export const svelteTransformer = (options) => ({
    transform: async (code, file) => {
        const baseFilePath = relative(process.cwd(), file)
        const tempFilePath = baseFilePath.replace(extname(baseFilePath), '.mjs')
        const tempFilePathOutput = join('.tmp', tempFilePath)

        const tempFilePathContents = `
import Component from "${file}"
import {render} from "svelte/server"

export const prerender = () => render(Component)
        `

        const svelteCompiler = await import('svelte/compiler')
        const { compile } = svelteCompiler
        const component = compile(code, {
            generate: 'server',
        })
        const componentClient = compile(code, {})
        const scriptId = `pub-${hash(code)}`

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
            plugins: [
                {
                    name: 'svelte-render',
                    setup(builder) {
                        builder.onResolve(
                            { filter: new RegExp(file) },
                            (args) => {
                                return {
                                    path: file,
                                }
                            },
                        )
                        builder.onLoad({ filter: new RegExp(file) }, (args) => {
                            return {
                                contents: component.js.code,
                                loader: 'js',
                            }
                        })
                    },
                },
            ],
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
            plugins: [
                {
                    name: 'svelte-render',
                    setup(builder) {
                        builder.onResolve(
                            { filter: new RegExp(file) },
                            (args) => {
                                return {
                                    path: file,
                                }
                            },
                        )
                        builder.onLoad({ filter: new RegExp(file) }, (args) => {
                            return {
                                contents: componentClient.js.code,
                                loader: 'js',
                            }
                        })
                    },
                },
            ],
        })

        const outputModule = await import(resolve(tempFilePathOutput))
        const { body, head } = outputModule.prerender()
        const outFile = clientBuildResult.outputFiles.find(
            (d) => d.path === '<stdout>',
        )
        if (outFile) {
            const html = options.layoutTemplate({
                head: `${head}`,
                content: `
                ${body}
                <script id="${scriptId}" type="module">
                ${Buffer.from(outFile.contents).toString('utf8')}
            </script>`,
            })
            return await htmlProcessor(html, options)
        }
        return code
    },
    ext: '.html',
})
