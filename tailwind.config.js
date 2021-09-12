module.exports = {
  purge: {
    enabled: process.env.NODE_ENV === 'production',
    content: [
      './lib/**/*.js',
      './lib/**/*.jsx',
      './lib/**/*.ts',
      './lib/**/*.tsx',
      './pages/**/*.js',
      './pages/**/*.jsx',
      './pages/**/*.ts',
      './pages/**/*.tsx'
    ]
  },
  darkMode: false, // or 'media' or 'class'
  theme: {
    screens: {
      sm: '640px',
      md: '768px',
      'wide-enough-for-nav': '800px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px'
    },
    extend: {}
  },
  variants: {
    extend: {}
  },
  plugins: []
}
