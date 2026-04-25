/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Colors from our mono design system
      colors: {
        // Mono background and surface
        'mono-bg': 'var(--mono-bg)',
        'mono-bg-strong': 'var(--mono-bg-strong)',
        'mono-surface': 'var(--mono-surface)',
        'mono-surface-muted': 'var(--mono-surface-muted)',

        // Text colors
        'mono-text': 'var(--mono-text)',
        'mono-text-muted': 'var(--mono-text-muted)',
        'mono-text-soft': 'var(--mono-text-soft)',

        // Accent (primary)
        'mono-accent': 'var(--mono-accent)',
        'mono-accent-strong': 'var(--mono-accent-strong)',
        'mono-accent-soft': 'var(--mono-accent-soft)',
        'mono-accent-contrast': 'var(--mono-accent-contrast)',

        // Semantic colors
        'mono-success-bg': 'var(--mono-success-bg)',
        'mono-success-text': 'var(--mono-success-text)',
        'mono-warning-bg': 'var(--mono-warning-bg)',
        'mono-warning-text': 'var(--mono-warning-text)',
        'mono-danger-bg': 'var(--mono-danger-bg)',
        'mono-danger-text': 'var(--mono-danger-text)',

        // For convenience, we also expose the accent as primary
        'primary': 'var(--mono-accent)',
        'primary-foreground': 'var(--mono-accent-contrast)',
      },
      // Spacing system (8px base)
      spacing: {
        '1': 'var(--space-1)',
        '2': 'var(--space-2)',
        '3': 'var(--space-3)',
        '4': 'var(--space-4)',
        '5': 'var(--space-5)',
        '6': 'var(--space-6)',
        '8': 'var(--space-8)',
        '10': 'var(--space-10)',
        '12': 'var(--space-12)',
        '16': 'var(--space-16)',
      },
      // Border radius
      borderRadius: {
        'sm': 'var(--mono-radius-sm)',
        'md': 'var(--mono-radius-md)',
        'lg': 'var(--mono-radius-lg)',
        'xl': 'var(--mono-radius-xl)',
        'full': 'var(--mono-radius-pill)',
      },
      // Shadows (elevation)
      boxShadow: {
        'sm': 'var(--mono-shadow-sm)',
        'md': 'var(--mono-shadow-md)',
        'lg': 'var(--mono-shadow-lg)',
      },
      // Transition easing
      transitionTimingFunction: {
        'mono': 'var(--mono-ease)',
      },
    },
  },
  plugins: [],
}