import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans:  ['var(--font-sans)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
      },
      colors: {
        'green-deep':  '#1a5c2a',
        'green-mid':   '#2d7a3e',
        'green-light': '#e8f5e9',
        terra:         '#c4622d',
        'terra-light': '#f9ede5',
        gold:          '#e8a020',
        'gold-light':  '#fef6e4',
        cream:         '#fdf8f0',
        'cream-dark':  '#f5eddf',
        soil:          '#2c1810',
        'soil-mid':    '#5c3d2e',
        muted:         '#8b7355',
        border:        '#d4c5a9',
      },
      animation: {
        'fade-up': 'fadeUp 0.5s ease both',
        'fade-in': 'fadeIn 0.4s ease both',
        shimmer:   'shimmer 1.4s infinite',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        shimmer: {
          from: { backgroundPosition: '-200% 0' },
          to:   { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
}

export default config
