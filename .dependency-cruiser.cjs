// dependency-cruiser config — module boundary enforcement.
// See PRINCIPLES.md §"Module boundaries" for the 5 rules + rationale.
// Run with: pnpm depcheck

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // -- Rule 1: No circular dependencies, ever. ----------------------------
    {
      name: 'no-circular',
      severity: 'error',
      comment:
        'Circular dependencies cause subtle bugs (TDZ errors, half-initialized modules) ' +
        'and slow incremental builds. Refactor — usually by extracting shared types.',
      from: {},
      to: { circular: true },
    },

    // -- Rule 2: Slice isolation. -------------------------------------------
    {
      name: 'no-cross-feature',
      severity: 'error',
      comment:
        'Feature slices may not import each other. ' +
        'Cross-slice sharing goes in src/core/ (cross-cutting) or a new shared slice. ' +
        'EXCEPTION: selected orchestrator/UI slices may import narrow dependencies from other slices. ' +
        'See docs/architecture.md and eslint.config.mjs for the matching exceptions.',
      from: { path: '^src/features/([^/]+)/' },
      to: {
        path: '^src/features/(?!\\1)([^/]+)/',
        pathNot: '^src/features/(matcher|classifier)/service\\.ts$',
      },
    },

    // -- Rule 3: src/core/ is a leaf. ---------------------------------------
    {
      name: 'core-is-leaf',
      severity: 'error',
      comment:
        'src/core/ is the lowest layer — anyone may import from it, but it ' +
        'cannot import from features or app. Otherwise core/ becomes a junk drawer.',
      from: { path: '^src/core/' },
      to: { path: '^src/(features|app|ui)/' },
    },

    // -- Rule 4: All Prisma access via core/db/. ----------------------------
    // THE rule that prevents multi-tenant data leaks.
    {
      name: 'no-direct-prisma',
      severity: 'error',
      comment:
        'Direct Prisma imports are forbidden outside src/core/db/ and the seed script. ' +
        'Use tenantDb(userId) from @/core/db so every query is tenant-scoped. ' +
        'See PRINCIPLES.md §"Database — multi-tenancy".',
      from: {
        path: '^src/',
        pathNot: '^src/core/db/',
      },
      to: { path: '@prisma/client|src/generated/prisma' },
    },

    // -- Rule 5: Orphan detection (warning, not error). ---------------------
    {
      name: 'no-orphans',
      severity: 'warn',
      comment:
        'Orphan modules (not imported anywhere) often indicate dead code. ' +
        'Confirm intentional and suppress with .dependency-cruiser.cjs override.',
      from: {
        orphan: true,
        pathNot: [
          '(?:^|/)\\.[^/]+\\.(?:js|cjs|mjs|ts)$', // dotfiles
          '\\.d\\.ts$',
          '(\\.|/)(test|spec)\\.(?:js|mjs|cjs|ts|tsx)$',
          '(^|/)tsconfig\\.json$',
          '(^|/)(babel|webpack|next|tailwind|postcss|eslint|prisma|vitest)\\.config\\.[^/]+$',
          '(^|/)dependency-cruiser\\.[^/]+$',
          'src/app/',         // Next.js routes are entrypoints (framework imports them)
          'src/instrumentation\\.',
          'src/generated/',
          'src/__mocks__/',   // Vitest mocks are referenced by alias in vitest.config.ts
          'scripts/seed\\.ts$',
          '(README|CHANGELOG|LICENSE)\\.md$',
        ],
      },
      to: {},
    },

    // -- Hygiene: don't import deprecated Node core modules ------------------
    {
      name: 'not-to-deprecated',
      severity: 'warn',
      comment: 'Deprecated Node.js core modules.',
      from: {},
      to: {
        dependencyTypes: ['core'],
        path: '^(punycode|domain|sys)$',
      },
    },
  ],

  options: {
    doNotFollow: { path: 'node_modules' },
    // Exclude paths from analysis — generated Prisma code has internal cycles
    // we cannot fix; tests use their own conventions.
    exclude: {
      path: [
        'src/generated/',
        'node_modules/',
      ],
    },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
    reporterOptions: {
      dot: { collapsePattern: 'node_modules/(?:@[^/]+/[^/]+|[^/]+)' },
      archi: {
        collapsePattern:
          '^(?:packages|src|lib|app|test|spec)/[^/]+|node_modules/(?:@[^/]+/[^/]+|[^/]+)',
      },
    },
  },
}
