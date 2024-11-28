/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ['./**/*.{html,md,js,hbs}', '!./node_modules'],
    theme: {
        extend: {},
    },
    plugins: [require('@tailwindcss/typography')],
}
