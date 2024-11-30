import { createHighlighter } from 'shiki'

const theme = 'min-dark'
const possibleCodeElements = document.querySelectorAll('pre > code')

const highlighter = await createHighlighter({
    langs: ['js', 'css', 'html', 'bash'],
    themes: [theme],
})

possibleCodeElements.forEach(async (el) => {
    const hasLangDef = [...el.classList.entries()].find((d) =>
        d[1].includes('language-'),
    )
    if (!hasLangDef) return

    const [, langClass] = hasLangDef
    const [, language] = langClass.split('-')

    el.parentElement.classList.add('not-prose')

    const output = highlighter.codeToHtml(el.innerHTML, {
        lang: language,
        theme: theme,
    })

    el.parentElement.outerHTML = output
})
