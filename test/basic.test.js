import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { expect, beforeAll, describe, it } from 'vitest'
import { compile } from '../lib/publish.mjs'
import { readFile } from 'fs/promises'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

describe('basic', async () => {
    let output

    beforeAll(async () => {
        output = await compile(join(__dirname, './samples/basic'), '', {})
    })

    it('has keys', async () => {
        expect(output).to.have.keys('/index.html', '/main.css')
    })

    it('matches transformed html', async () => {
        expect(output['/index.html']).to.matchSnapshot()
    })

    it('matches transformed css', async () => {
        const sourceCode = await readFile(
            join(__dirname, './samples/basic/main.css'),
            'utf8',
        )
        expect(sourceCode).has.string("@import 'modern-normalize';")
        expect(output['/main.css']).to.matchSnapshot()
        expect(output['/main.css'].content).not.has.string(
            "@import 'modern-normalize';",
        )
    })
})
