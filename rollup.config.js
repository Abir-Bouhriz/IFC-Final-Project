import resolve from '@rollup/plugin-node-resolve'

export default {
  input: 'script.js',
  output: [
    {
      format: 'esm',
      file: 'bundle.js'
    }
  ],
  plugins: [
    resolve()
  ]
}
