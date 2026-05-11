/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink:     { DEFAULT: '#0A0B0F', 2: '#0F1117', 3: '#161820', 4: '#1E2028' },
        surface: '#252830',
        accent:  '#00E5CC',
        up:      '#22C55E',
        down:    '#EF4444',
        warn:    '#F59E0B',
        t1:      '#F0F2F5',
        t2:      '#9BA3B0',
        t3:      '#5A6272',
      },
      fontFamily: {
        display: ['"Syne"', 'sans-serif'],
        mono:    ['"DM Mono"', 'monospace'],
        body:    ['"DM Sans"', 'sans-serif'],
        sans:    ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
      borderRadius: { DEFAULT: '2px', sm: '2px', md: '2px', lg: '4px', xl: '4px', '2xl': '6px' },
      animation: {
        'in': 'pageIn 0.3s ease forwards',
        'ticker': 'ticker 30s linear infinite',
        'pulse-dot': 'livePulse 2.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
