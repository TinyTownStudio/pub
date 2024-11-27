import { createRequire } from 'node:module'
import { networkInterfaces as getNetworkInterfaces } from 'node:os'

export function getPkgJSON() {
    const r = createRequire(import.meta.url)
    const output = r('../package.json')
    return output
}

// https://github.com/lukeed/bundt/blob/011eec32ff3495a5e46ed337075a60530111cda1/index.js#L21
const UNITS = ['B ', 'kB', 'MB', 'GB']
export function size(val = 0) {
    if (val < 1000) return `${val} ${UNITS[0]}`
    let exp = Math.min(Math.floor(Math.log10(val) / 3), UNITS.length - 1) || 1
    let out = (val / Math.pow(1000, exp)).toPrecision(3)
    let idx = out.indexOf('.')
    if (idx === -1) {
        out += '.00'
    } else if (out.length - idx - 1 !== 2) {
        out = (out + '00').substring(0, idx + 3) // 2 + 1 for 0-based
    }
    return out + ' ' + UNITS[exp]
}

export function getNetwork() {
    const networkInterfaces = getNetworkInterfaces()
    for (const interfaceDetails of Object.values(networkInterfaces)) {
        if (!interfaceDetails) continue
        for (const details of interfaceDetails) {
            const { address, family, internal } = details

            if (family === 'IPv4' && !internal) return address
        }
    }
}
