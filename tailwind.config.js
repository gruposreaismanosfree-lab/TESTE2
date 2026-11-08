export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#0b0a10',
        foreground: '#f4f1fa',
        card: '#15121e',
        muted: '#aaa4bb',
        border: '#30283e',
        primary: 'rgb(var(--ws-accent, 245 112 209) / <alpha-value>)',
      },
    },
  },
  plugins: [],
};
