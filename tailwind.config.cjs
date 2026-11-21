/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: '#090d12',
        panel: '#0f141c',
        surface: '#151b24',
        'surface-hover': '#1b2330',
        stroke: '#222c3a',
        'stroke-hover': '#374558',
        accent: '#10b981',
        'accent-dim': 'rgba(16, 185, 129, 0.08)',
        'accent-cyan': '#38bdf8',
        'accent-cyan-dim': 'rgba(56, 189, 248, 0.08)',
        'accent-amber': '#f59e0b',
        'text-main': '#f1f5f9',
        'text-muted': '#94a3b8',
        'text-dim': '#64748b',
        'code-bg': '#0b0f15',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'glow-accent': '0 0 24px -4px rgba(16, 185, 129, 0.15)',
        'card-subtle': '0 1px 3px 0 rgba(0, 0, 0, 0.4), 0 1px 2px -1px rgba(0, 0, 0, 0.4)',
      },
    },
  },
  plugins: [],
};
