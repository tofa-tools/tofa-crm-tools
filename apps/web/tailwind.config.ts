import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // TOFA Brand Colors
        'tofa-gold': {
          DEFAULT: '#D4AF37',
          50: '#faf7ed',
          100: '#f5eed1',
          200: '#ebdcab',
          300: '#e0c97f',
          400: '#d4af37',
          500: '#c19d2a',
          600: '#a08023',
          700: '#7f641e',
          800: '#6e541c',
          900: '#5d4619',
        },
        'tofa-navy': {
          DEFAULT: '#0A192F',
          50: '#f0f4f8',
          100: '#d9e2ec',
          200: '#bcccdc',
          300: '#9fb3c8',
          400: '#829ab1',
          500: '#627d98',
          600: '#486581',
          700: '#334e68',
          800: '#243b53',
          900: '#0A192F',
        },
        // Brand Tokens for SaaS Standardization (CSS Variables)
        brand: {
          primary: 'var(--brand-primary)',
          accent: 'var(--brand-accent)',
          surface: 'var(--brand-surface)',
        },
        primary: {
          50: '#f0f4ff',
          100: '#e0e9ff',
          200: '#c7d7fe',
          300: '#a4bafe',
          400: '#8195f9',
          500: '#667eea',
          600: '#5a67d8',
          700: '#4c51bf',
          800: '#434190',
          900: '#764ba2',
        },
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        'gradient-tofa-gold': 'linear-gradient(135deg, #D4AF37 0%, #c19d2a 50%, #a08023 100%)',
        'gradient-tofa-navy': 'linear-gradient(135deg, #0A192F 0%, #243b53 50%, #334e68 100%)',
      },
      fontFamily: {
        'cinzel': ['var(--font-cinzel)', 'serif'],
        'playfair': ['var(--font-playfair)', 'serif'],
        'bodoni': ['var(--font-bodoni)', 'serif'],
        'montserrat': ['var(--font-montserrat)', 'sans-serif'],
        'bebas': ['var(--font-bebas)', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config


