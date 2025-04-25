import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/lib/index.ts'),
      name: 'RxJSSQLite',
      fileName: 'rxjs-sqlite',
    },
    rollupOptions: {
      external: ['rxjs', 'better-sqlite3', 'sqlite3'],
      output: {
        globals: {
          rxjs: 'rxjs',
          'better-sqlite3': 'BetterSQLite3',
          sqlite3: 'SQLite3',
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ['src/lib/rxdb-adapter']
  }
});
