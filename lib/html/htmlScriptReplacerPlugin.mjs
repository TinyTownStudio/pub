import { extname } from 'node:path'

export const htmlScriptReplacerPlugin = (tree) => {
    tree.walk((node) => {
        if (!node) return node
        if (node.tag !== 'script') return node
        const currentSource = node.attrs['src']
        if (!currentSource) return node
        const sourceLink = currentSource.match(/^(\/?)((\w+\.?)+)/)
        if (!sourceLink) return node

        const link = sourceLink[2]
        if (link.startsWith('http')) {
            return node
        }

        node.attrs['src'] = node.attrs['src'].replace(
            extname(node.attrs['src']),
            '.mjs',
        )
        return node
    })
}
