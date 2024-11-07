const esbuild = require('esbuild');

const args = process.argv.slice(2);
const watch = args.includes('--watch');

const buildOptions = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  sourcemap: true,
  platform: 'node',
  target: 'es2020',
  outdir: 'dist',
  external: ['vscode']
};

if (watch) {
  esbuild.context(buildOptions).then(ctx => {
    ctx.watch();
  }).catch(() => process.exit(1));
} else {
  esbuild.build(buildOptions).catch(() => process.exit(1));
}
