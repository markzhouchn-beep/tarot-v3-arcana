/** @type {import('tailwindcss').Config} */
// v3.0 · 沿用 v2.0 完整 design tokens（Mystical Vintage Dark · 收紧字体）
// 来源：~/Desktop/tarot-app/prototype/_spec/design-tokens.md
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // ─── Raw · 原子层（不直接用）───
        parchment:  { DEFAULT: '#1a1410', warm: '#221a14', deep: '#2d2218' },
        crimson:    { DEFAULT: '#a83a3a', deep: '#6b1f1f', light: '#c46868' },
        gold:       { DEFAULT: '#c8985b', bright: '#e0b878', dim: '#8c6e3f' },
        ink:        { DEFAULT: '#f0e3d0', soft: '#c8b89c', faint: '#8a7a64' },
        occult:     { DEFAULT: '#0a0806', soft: '#1a1310' },
        accent:     { green: '#3e5c3a', mauve: '#6b4a5c' },

        // ─── Semantic · 语义层（组件用这个）───
        bg: {
          canvas:        '#0e0a07',
          panel:         '#1a1310',
          occult:        '#0a0806',
          'occult-soft': '#221a14',
        },
        fg: {
          DEFAULT:       '#f0e3d0',
          secondary:     '#c8b89c',
          faint:         '#8a7a64',
          'on-occult':   '#f0e3d0',
          'on-crimson':  '#f0e3d0',
          accent:        '#c8985b',
        },
        border: {
          strong:        '#c8985b',
          DEFAULT:       'rgba(200, 152, 91, 0.25)',
          soft:          'rgba(200, 152, 91, 0.12)',
          faint:         'rgba(200, 152, 91, 0.06)',
        },
        primary: {
          DEFAULT:       '#c8985b',
          deep:          '#a07a3f',
          light:         '#e0b878',
        },
        secondary: {
          DEFAULT:       '#a83a3a',
          bright:        '#c46868',
          dim:           '#6b1f1f',
        },
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', '"Noto Serif SC"', '"EB Garamond"', 'Georgia', 'serif'],
        caps:    ['Cinzel', '"Cormorant Garamond"', 'serif'],
        script:  ['Tangerine', '"Pinyon Script"', 'cursive'],
        body:    ['Inter', '"Noto Sans SC"', 'sans-serif'],
      },
      fontSize: {
        xxs:    ['10px', { lineHeight: '1.4' }],
        xs:     ['11px', { lineHeight: '1.4' }],
        sm:     ['13px', { lineHeight: '1.5' }],
        md:     ['14px', { lineHeight: '1.6' }],
        lg:     ['16px', { lineHeight: '1.6' }],
        xl:     ['19px', { lineHeight: '1.5' }],
        '2xs':  ['10px', { lineHeight: '1.4' }],
        '2xl':  ['22px', { lineHeight: '1.4' }],
        '3xl':  ['28px', { lineHeight: '1.3' }],
        '4xl':  ['38px', { lineHeight: '1.2' }],
        '5xl':  ['52px', { lineHeight: '1.1' }],
        '6xl':  ['72px', { lineHeight: '1.0' }],
      },
      spacing: {
        xxs:  '2px',
        xs:   '4px',
        sm:   '8px',
        md:   '12px',
        lg:   '18px',
        xl:   '24px',
        '2xl': '36px',
        '3xl': '52px',
        '4xl': '72px',
        '5xl': '96px',
      },
      boxShadow: {
        sm:  '0 2px 8px  rgba(0, 0, 0, 0.4)',
        md:  '0 8px 24px rgba(0, 0, 0, 0.5)',
        lg:  '0 20px 50px rgba(0, 0, 0, 0.6)',
        'glow-gold':         '0 0 40px rgba(200, 152, 91, 0.4)',
        'glow-gold-lg':      '0 0 80px rgba(200, 152, 91, 0.35), 0 0 160px rgba(200, 152, 91, 0.18)',
        'glow-gold-strong':  '0 0 60px rgba(224, 184, 120, 0.55), 0 0 120px rgba(200, 152, 91, 0.35)',
        'glow-crimson':      '0 0 60px rgba(168, 58, 58, 0.3)',
        'inset-hairline':    'inset 0 1px 0 rgba(200, 152, 91, 0.08)',
      },
      transitionTimingFunction: {
        default: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      transitionDuration: {
        fast: '200ms',
        '400': '400ms',
        slow: '800ms',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'draw-card': {
          '0%':   { transform: 'rotateY(180deg)', opacity: '0' },
          '100%': { transform: 'rotateY(0deg)',   opacity: '1' },
        },
        'shuffle': {
          '0%':   { transform: 'translateX(0)     rotate(0deg)' },
          '25%':  { transform: 'translateX(-12px) rotate(-3deg)' },
          '50%':  { transform: 'translateX(12px)  rotate(3deg)' },
          '75%':  { transform: 'translateX(-8px)  rotate(-2deg)' },
          '100%': { transform: 'translateX(0)     rotate(0deg)' },
        },
        'cut': {
          '0%':   { transform: 'translateY(0)     rotate(0deg)' },
          '50%':  { transform: 'translateY(-20px) rotate(8deg)' },
          '100%': { transform: 'translateY(0)     rotate(-2deg)' },
        },
        'pulse': {
          '0%, 100%': { opacity: '0.5' },
          '50%':      { opacity: '1' },
        },
        'shimmer': {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'glow': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(200, 152, 91, 0.2)' },
          '50%':      { boxShadow: '0 0 40px rgba(200, 152, 91, 0.4)' },
        },
        'orb-breathe': {
          '0%, 100%': { opacity: '0.55', transform: 'scale(1)' },
          '50%':      { opacity: '0.95', transform: 'scale(1.08)' },
        },
        'orb-breathe-slow': {
          '0%, 100%': { opacity: '0.4', transform: 'scale(1.04)' },
          '50%':      { opacity: '0.85', transform: 'scale(0.96)' },
        },
        'float-y': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-12px)' },
        },
      },
      animation: {
        'fade-in':         'fade-in 400ms cubic-bezier(0.4, 0, 0.2, 1)',
        'draw-card':       'draw-card 800ms cubic-bezier(0.4, 0, 0.2, 1)',
        'shuffle':         'shuffle 600ms ease-in-out',
        'cut':             'cut 600ms ease-in-out',
        'pulse':           'pulse 2s ease-in-out infinite',
        'shimmer':         'shimmer 3s linear infinite',
        'glow':            'glow 3s ease-in-out infinite',
        'orb-breathe':     'orb-breathe 6s ease-in-out infinite',
        'orb-breathe-slow':'orb-breathe-slow 8s ease-in-out infinite',
        'float-y':         'float-y 4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
