import { defineConfig } from '@strapi/pack-up';
// import prismjs from 'vite-plugin-prismjs';

export default defineConfig({
  minify: false,
  sourcemap: false,
  externals: ['path', 'fs', '@lexical/*', 'prismjs', 'prism', '@lexical/code', 'prism*'],
  plugins: [
    // prismjs({
    //   languages: 'all',
    // }),
  ],
  unstable_viteConfig: {
    assetsInclude: ['**/*.svg', '**/*.gif', '**/*.png', '**/*.jpe?g'],
  },
});
