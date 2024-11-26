import { createRequire } from 'node:module'

export function getPkgJSON() {
    const r = createRequire(import.meta.url)
    const output = r('../package.json')
    return output
}

const UNITS = ['B ', 'kB', 'MB', 'GB']

export function size(val = 0) {
    if (val < 1e3) return `${val} ${UNITS[0]}`
    let exp = Math.min(Math.floor(Math.log10(val) / 3), UNITS.length - 1) || 1
    let out = (val / Math.pow(1e3, exp)).toPrecision(3)
    let idx = out.indexOf('.')
    if (idx === -1) {
        out += '.00'
    } else if (out.length - idx - 1 !== 2) {
        out = (out + '00').substring(0, idx + 3) // 2 + 1 for 0-based
    }
    return out + ' ' + UNITS[exp]
}
