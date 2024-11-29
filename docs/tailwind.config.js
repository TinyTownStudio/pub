/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ['./**/*.{html,md,js,mustache}', '!./node_modules'],
    theme: {
        extend: {},
    },
    plugins: [require('@tailwindcss/typography')],
}
