/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: {
          primary: 'var(--color-background-primary)',
          secondary: 'var(--color-background-secondary)',
          tertiary: 'var(--color-background-tertiary)',
          success: 'var(--color-background-success)',
          warning: 'var(--color-background-warning)',
          danger: 'var(--color-background-danger)',
          info: 'var(--color-background-info)',
        },
        foreground: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          tertiary: 'var(--color-text-tertiary)',
          success: 'var(--color-text-success)',
          warning: 'var(--color-text-warning)',
          danger: 'var(--color-text-danger)',
          info: 'var(--color-text-info)',
        },
        border: {
          primary: 'var(--color-border-primary)',
          secondary: 'var(--color-border-secondary)',
          tertiary: 'var(--color-border-tertiary)',
          success: 'var(--color-border-success)',
          warning: 'var(--color-border-warning)',
          danger: 'var(--color-border-danger)',
          info: 'var(--color-border-info)',
        },
        radius: {
          sm: 'var(--radius-sm)',
          md: 'var(--radius-md)',
          lg: 'var(--radius-lg)',
          xl: 'var(--radius-xl)',
          full: 'var(--radius-full)',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
      fontSize: {
        'page-title': ['22px', { lineHeight: '1.3', fontWeight: '500' }],
        'section-title': ['18px', { lineHeight: '1.3', fontWeight: '500' }],
        'card-title': ['16px', { lineHeight: '1.3', fontWeight: '500' }],
        body: ['14px', { lineHeight: '1.6', fontWeight: '400' }],
        small: ['13px', { lineHeight: '1.6', fontWeight: '400' }],
        meta: ['12px', { lineHeight: '1.5', fontWeight: '500' }],
        'section-label': ['11px', { lineHeight: '1.4', fontWeight: '500' }],
      },
      spacing: {
        '1': '4px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '6': '24px',
        '10': '40px',
      },
    },
  },
  plugins: [],
};