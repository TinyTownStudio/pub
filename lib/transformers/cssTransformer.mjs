import postcss from 'postcss'
import postcssImport from 'postcss-import'
import postcssrc from 'postcss-load-config'
import cssnanoLite from '../html/css-nano.mjs'

export const cssTransformer = () => ({
    transform: async (code, file) => {
        const { plugins, options } = await postcssrc().catch(err=>{
          if(String(err).includes("No PostCSS Config found")){
            return {
              plugins:[],
              options:{}
            }
          }
          throw err
        })
        const result = await postcss(
            ...plugins,
            ...cssnanoLite(),
            postcssImport(),
        ).process(code, {
            ...options,
            from: file,
        })
        console.log({result})
        return result.css
    },
    ext: '.css',
})
