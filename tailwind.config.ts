import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        fin: {
          orange:     '#FF5600',
          'deep-blue':'#080F1E',
          'off-white':'#F6F6F1',
          navy: {
            5:  '#151B29',
            10: '#212735',
            20: '#393F4B',
            30: '#535762',
            40: '#6B6F78',
          },
        },
      },
      fontFamily: {
        display: ['var(--font-cormorant)', 'Georgia', 'serif'],
        ui:      ['var(--font-inter)', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
