import { createHighlighter } from 'shiki'

theme = 'min-dark'
possibleCodeElements = document.querySelectorAll('pre > code')

highlighter = await createHighlighter({
    langs: ['js', 'css', 'html', 'bash'],
    themes: [theme],
})

possibleCodeElements.forEach ((el) -> 
    hasLangDef = [...el.classList.entries()].find((d) =>
        d[1].includes('language-')
    ) 
    if hasLangDef then (
      [, langClass] = hasLangDef
      [, language] = langClass.split('-')
      el.parentElement.classList.add('not-prose')
      output = highlighter.codeToHtml(el.innerHTML, {
          lang: language,
          theme: theme,
      })
      el.parentElement.outerHTML = output
    )
)