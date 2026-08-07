/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Arial', 'Calibri', 'Helvetica', 'sans-serif'],
        heading: ['Calibri', 'Calibri Light', 'Arial', 'sans-serif'],
        serif: ['Times New Roman', 'Times', 'serif'],
        mono: ['Consolas', 'Courier New', 'monospace'],
      },
      colors: {
        brand: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
        navy: {
          800: '#0f172a',
          900: '#0a101d',
        },
      },
    },
  },
  plugins: [],
};
