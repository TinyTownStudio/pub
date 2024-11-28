import { build } from 'esbuild'
import { transform as sucraseTransform } from 'sucrase'
import htmlnano from 'htmlnano'
import { marked } from 'marked'
import fs from 'node:fs'
import { extname, join, resolve } from 'node:path'
import postcss from 'postcss'
import postcssrc from 'postcss-load-config'
import postcssImport from 'postcss-import'
import posthtml from 'posthtml'
import posthtmlBaseURL from 'posthtml-base-url'
import { compile as templateCompile } from 'tempura'
import glob from 'tiny-glob'

const htmlTranformer = (options) => ({
    transform: async (code) => {
        let toCompile = code
        if (options.layoutTemplate) {
            toCompile = await options.layoutTemplate?.({
                content: code,
            })
        }
        const output = await posthtml([
            posthtmlBaseURL({
                url: options.baseUrl,
                allTags: true,
            }),
            htmlnano(),
        ]).process(toCompile)
        return output.html
    },
    ext: '.html',
})

const cssTransformer = () => ({
    transform: async (code, file) => {
        const { plugins, options } = await postcssrc()
        const result = await postcss(...plugins, postcssImport()).process(
            code,
            {
                ...options,
                from: file,
            },
        )
        return result.css
    },
    ext: '.css',
})

const jsTransformer = (transformerOptions) => ({
    transform: async (code, file) => {
        const transformedCode = sucraseTransform(code, {
            transforms: ['jsx'],
            production: true,
            jsxImportSource: transformerOptions.jsxImportSource ?? 'preact',
            jsxRuntime: 'automatic',
        })
        const result = await build({
            stdin: {
                contents: transformedCode.code,
                resolveDir: process.cwd(),
                sourcefile: file,
            },
            bundle: true,
            format: 'esm',
            outExtension: {
                '.js': '.mjs',
            },
            treeShaking: true,
            platform: 'browser',
            write: false,
        })
        const outFile = result.outputFiles.find((d) => d.path === '<stdout>')
        if (outFile) {
            return Buffer.from(outFile.contents).toString('utf8')
        }
        return code
    },
    ext: '.mjs',
})

export async function compile(basePath, distPath, options) {
    const transformerOptions = {
        baseUrl: options.baseUrl,
        jsxImportSource: options.jsxImportSource,
    }
    const layoutSource = options.layoutFile ?? join(basePath, '_layout.hbs')
    const layoutExists = await fs.promises
        .access(layoutSource)
        .then((_) => true)
        .catch((_) => false)
    if (layoutExists) {
        const templateContent = `
{{#expect content}}        
${await fs.promises.readFile(layoutSource, 'utf8')}            
        `
        transformerOptions.layoutTemplate = templateCompile(templateContent)
    }

    const files = (
        await glob('./**/*', {
            cwd: basePath,
            filesOnly: true,
            absolute: true,
        })
    ).filter(
        (d) =>
            d != resolve(layoutSource) &&
            !d.startsWith(resolve('node_modules')) &&
            (distPath ? !d.startsWith(resolve(distPath)) : true),
    )

    const transformersByExtensions = Object.assign(
        {},
        {
            '.js': jsTransformer(transformerOptions),
            '.jsx': jsTransformer(transformerOptions),
            '.tsx': jsTransformer(transformerOptions),
            '.mjs': jsTransformer(transformerOptions),
            '.ts': jsTransformer(transformerOptions),
            '.scss': cssTransformer(transformerOptions),
            '.css': cssTransformer(transformerOptions),
            '.md': (() => ({
                transform: (code) => marked(code),
                ext: '.html',
            }))(transformerOptions),
            '.html': htmlTranformer(transformerOptions),
        },
        options?.transformers ?? {},
    )

    const done = await Promise.allSettled(
        files.map(async (d) => {
            let distFile
            const data = await fs.promises.readFile(d, 'utf8')
            const transformer = transformersByExtensions[extname(d)]
            let content = data
            let slug = d.replace(resolve(basePath), '')
            if (transformer) {
                slug = slug.replace(extname(d), transformer.ext)
                content = await transformer.transform(content, d)
                if (transformer.ext) {
                    if (transformer.ext !== extname(d)) {
                        const postTransformer =
                            transformersByExtensions[transformer.ext]
                        content = await postTransformer.transform(content, d)
                    }
                    if (distPath) {
                        distFile = resolve(d)
                            .replace(resolve(basePath), resolve(distPath))
                            .replace(extname(d), transformer.ext)
                    }
                }
            }

            return [
                slug,
                {
                    source: d,
                    content: content,
                    dist: distPath ? distFile : '',
                },
            ]
        }),
    )

    const errors = done
        .filter((d) => d.status === 'rejected')
        .map((d) => d.reason)

    if (errors.length) {
        errors.forEach((d) => console.error(d))
    }

    const compiled = done
        .filter((d) => d.status === 'fulfilled')
        .map((d) => {
            return d.value
        })

    return Object.fromEntries(compiled)
}
