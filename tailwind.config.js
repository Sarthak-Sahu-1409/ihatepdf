export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#0f172a',
        foreground: '#f8fafc',
        primary: '#6366f1',
        'primary-foreground': '#ffffff',
        secondary: '#8b5cf6',
        'secondary-foreground': '#ffffff',
      },
      fontFamily: {
        manrope: ['Manrope', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
};