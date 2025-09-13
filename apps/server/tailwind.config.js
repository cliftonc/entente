/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/ui/**/*.{js,ts,jsx,tsx}',
    './src/ui/index.html',
  ],
  theme: {
    extend: {},
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: [
      'light',
      'dark',
      {
        entente: {
          primary: '#3b82f6',
          secondary: '#10b981',
          accent: '#f59e0b',
          neutral: '#374151',
          'base-100': '#ffffff',
          'base-200': '#f3f4f6',
          'base-300': '#e5e7eb',
          info: '#06b6d4',
          success: '#10b981',
          warning: '#f59e0b',
          error: '#ef4444',
        },
      },
    ],
    base: true,
    styled: true,
    utils: true,
  },
}