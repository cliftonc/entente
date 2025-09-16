/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/ui/**/*.{js,ts,jsx,tsx}', './src/ui/index.html'],
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
          'primary-content': '#ffffff',
          secondary: '#10b981',
          'secondary-content': '#ffffff',
          accent: '#f59e0b',
          'accent-content': '#000000',
          neutral: '#374151',
          'neutral-content': '#ffffff',
          'base-100': '#ffffff',
          'base-200': '#f3f4f6',
          'base-300': '#e5e7eb',
          'base-content': '#1f2937',
          info: '#06b6d4',
          'info-content': '#ffffff',
          success: '#10b981',
          'success-content': '#ffffff',
          warning: '#f59e0b',
          'warning-content': '#000000',
          error: '#ef4444',
          'error-content': '#ffffff',
        },
      },
    ],
    base: true,
    styled: true,
    utils: true,
  },
}
