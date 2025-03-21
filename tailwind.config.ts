import type { Config } from "tailwindcss";

export default {
    darkMode: ["class"],
    content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
  	extend: {
  		colors: {
  			foreground: 'var(--text-color)',
  			dark: 'var(--dark-color)',
  			primary: 'var(--primary-color)',
  			secondary: 'var(--secondary-color)',
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		fontFamily: {
  			primary: 'var(--font-plus-jakarta-sans)',
  			secondary: 'var(--font-space-grotesk)'
  		},

		sidebar: {
			'collapsed': 'var(--collapsed-width)',
			'expanded': 'var(--expanded-width)',
		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
