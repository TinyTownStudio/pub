import posthtml from 'posthtml'
import posthtmlBaseURL from 'posthtml-base-url'
import { htmlScriptReplacerPlugin } from '../html/htmlScriptReplacerPlugin.mjs'

export const htmlProcessor = async (baseHTML, options) => {
    return (
        await posthtml([
            htmlScriptReplacerPlugin,
            posthtmlBaseURL({
                url: options.baseUrl,
                allTags: true,
            }),
        ]).process(baseHTML)
    ).html
}
