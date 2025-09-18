import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
// import html from '@rollup/plugin-html';
import copy from 'rollup-plugin-copy';
import postcss from 'rollup-plugin-postcss';

const isProduction = process.env.NODE_ENV === 'production';

export default {
  input: 'src/index.js',
  output: {
    file: 'dist/bundle.js',
    format: 'iife',
    sourcemap: true
  },
  plugins: [
    // Resolve and bundle dependencies
    resolve({
      browser: true,
      preferBuiltins: false
    }),
    commonjs(),
    
    // Bundle CSS
    postcss({
      extract: 'styles.css',
      minimize: isProduction
    }),
    
    // Copy HTML template and inject build assets
    copy({
      targets: [
        { 
          src: 'src/index.html', 
          dest: 'dist',
          transform: (contents, filename) => {
            const html = contents.toString();
            // Replace the CSS href to point to built styles
            return html.replace(
              'href="styles/main.css"',
              'href="styles.css"'
            ).replace(
              'src="bundle.js"',
              'src="bundle.js"'
            );
          }
        }
      ]
    }),
    
    
    // Minify in production
    isProduction && terser()
  ].filter(Boolean)
};