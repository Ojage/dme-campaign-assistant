import animate from 'tailwindcss-animate'

/** Design tokens are stored as bare HSL channels so Tailwind can apply opacity modifiers. */
const token = (variable) => `hsl(var(${variable}) / <alpha-value>)`

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        background: token('--background'),
        foreground: token('--foreground'),
        card: {
          DEFAULT: token('--card'),
          foreground: token('--card-foreground'),
        },
        popover: {
          DEFAULT: token('--popover'),
          foreground: token('--popover-foreground'),
        },
        primary: {
          DEFAULT: token('--primary'),
          foreground: token('--primary-foreground'),
        },
        secondary: {
          DEFAULT: token('--secondary'),
          foreground: token('--secondary-foreground'),
        },
        muted: {
          DEFAULT: token('--muted'),
          foreground: token('--muted-foreground'),
        },
        'body-foreground': token('--body-foreground'),
        accent: {
          DEFAULT: token('--accent'),
          foreground: token('--accent-foreground'),
        },
        destructive: {
          DEFAULT: token('--destructive'),
          foreground: token('--destructive-foreground'),
        },
        warning: {
          DEFAULT: token('--warning'),
          foreground: token('--warning-foreground'),
        },
        success: {
          DEFAULT: token('--success'),
          foreground: token('--success-foreground'),
        },
        border: token('--border'),
        input: token('--input'),
        ring: token('--ring'),
        bar: {
          DEFAULT: token('--bar'),
          hover: token('--bar-hover'),
          foreground: token('--bar-foreground'),
        },
        sidebar: {
          DEFAULT: token('--sidebar'),
          foreground: token('--sidebar-foreground'),
          accent: token('--sidebar-accent'),
          border: token('--sidebar-border'),
        },
        chart: {
          1: token('--chart-1'),
          2: token('--chart-2'),
          3: token('--chart-3'),
          4: token('--chart-4'),
          5: token('--chart-5'),
        },
      },
      fontFamily: {
        sans: 'var(--font-sans)',
        mono: 'var(--font-mono)',
      },
      borderRadius: {
        xl: 'calc(var(--radius) + 4px)',
        lg: 'var(--radius)',
        md: 'var(--radius-md)',
        sm: 'var(--radius-sm)',
      },
      boxShadow: {
        'retool-sm': 'var(--shadow-retool-sm)',
        'retool-md': 'var(--shadow-retool-md)',
        'retool-lg': 'var(--shadow-retool-lg)',
      },
      spacing: {
        'density-xs': 'var(--density-xs)',
        'density-sm': 'var(--density-sm)',
        'density-md': 'var(--density-md)',
        'density-lg': 'var(--density-lg)',
        'density-xl': 'var(--density-xl)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        /* The comet is half the rail wide and travels -100% → 200% of its own
           width, i.e. -50% → +100% of the rail. It is therefore on-screen for the
           whole cycle instead of flashing past; only the gradient's transparent
           ends give it a soft entry and exit. */
        'assistant-sweep': {
          '0%': { transform: 'translate3d(-100%, 0, 0)', opacity: '0' },
          '8%': { opacity: '1' },
          '82%': { opacity: '1' },
          '100%': { transform: 'translate3d(200%, 0, 0)', opacity: '0' },
        },
        'assistant-bloom': {
          '0%, 100%': { opacity: '0.3', transform: 'scaleX(0.94)' },
          '50%': { opacity: '0.85', transform: 'scaleX(1)' },
        },
        'assistant-core': {
          '0%, 100%': { opacity: '0.45' },
          '50%': { opacity: '1' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'assistant-sweep': 'assistant-sweep 1.7s cubic-bezier(0.45, 0, 0.25, 1) infinite',
        'assistant-bloom': 'assistant-bloom 2.6s ease-in-out infinite',
        'assistant-core': 'assistant-core 1.15s ease-in-out infinite',
      },
    },
  },
  plugins: [animate],
}
