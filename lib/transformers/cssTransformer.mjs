import postcss from 'postcss'
import postcssImport from 'postcss-import'
import postcssrc from 'postcss-load-config'
import cssnanoLite from '../html/css-nano.mjs'

export const cssTransformer = () => ({
    transform: async (code, file) => {
        const { plugins, options } = await postcssrc()
        const result = await postcss(
            ...plugins,
            ...cssnanoLite(),
            postcssImport(),
        ).process(code, {
            ...options,
            from: file,
        })
        return result.css
    },
    ext: '.css',
})
