import { Plus_Jakarta_Sans, Space_Grotesk } from 'next/font/google'

const plus_jakarta_sans = Plus_Jakarta_Sans({
    variable: '--font-plus-jakarta-sans',
    subsets: ['latin'],
    display: 'swap'
})

const space_grotesk = Space_Grotesk({
    variable: '--font-space-grotesk',
    subsets: ['latin'],
    display: 'swap'
})

const fontVariables = [
    plus_jakarta_sans.variable,
    space_grotesk.variable
].join(' ');

export default fontVariables
