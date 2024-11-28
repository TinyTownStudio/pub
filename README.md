# @tinytown/pub

A tiny pre-processor for tiny websites

```sh
# dev server
npx -p @tinytown/pub pub ./src

# build assets
npx -p @tinytown/pub pub ./dist
```

## Features

- JS Support
    - JSX (Defaults to `preact`)
    - ESM by default
- Markdown
    - Custom Layouts
    - Base URL Support
    - Front matter
- HTML
    - Minifier
    - Base URL Support
- CSS
    - Full PostCSS Support
        - Comes with postcss-import support (bundles css from `node_module`)

Built with ❤️ at [tinytown.studio](https://tinytown.studio/)
