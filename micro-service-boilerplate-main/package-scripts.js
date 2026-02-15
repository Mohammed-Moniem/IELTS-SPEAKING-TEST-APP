/**
 * Windows: Please do not use trailing comma as windows will fail with token error
 */

const { series, rimraf } = require('nps-utils');

module.exports = {
  scripts: {
    default: 'nps start',
    /**
     * Starts the builded app from the dist directory.
     */
    start: {
      script: 'cross-env NODE_ENV=production node dist/src/app.js',
      description: 'Starts the builded app'
    },
    /**
     * Serves the current app and watches for changes to restart it
     */
    serve: {
      inspector: {
        script: series(
          'nps banner.serve',
          'nodemon --watch src --watch .env --ext ts,js,json --inspect --exec "ts-node --transpile-only -r tsconfig-paths/register src/app.ts"'
        ),
        description: 'Serves the current app and watches for changes to restart it, you may attach inspector to it.'
      },
      script: series(
        'nps banner.serve',
        'nodemon --watch src --watch .env --ext ts,js,json --exec "ts-node --transpile-only -r tsconfig-paths/register src/app.ts"'
      ),
      description: 'Serves the current app and watches for changes to restart it'
    },
    /**
     * Setup of the development environment
     */
    setup: {
      script: series('npm install'),
      description: 'Setup`s the development environment(yarn & database)'
    },
    /**
     * Creates the needed configuration files
     */
    config: {
      // `ormconfig.json` was used for the legacy Mongo/TypeORM setup. The Supabase
      // migration doesn't use it, but we still generate `tsconfig.build.json` for `tsc`.
      script: series(runFast('./commands/tsconfig.ts')),
      hiddenFromHelp: true
    },
    /**
     * Builds the app into the dist directory
     */
    build: {
      script: series(
        'nps banner.build',
        'nps config',
        // 'nps lint',
        'nps clean.dist',
        'nps transpile',
        'nps copy'
      ),
      description: 'Builds the app into the dist directory'
    },
    /**
     * Runs TSLint over your project
     */
    lint: {
      script: 'eslint .',
      hiddenFromHelp: true
    },
    /**
     * Transpile your app into javascript
     */
    transpile: {
      script: `tsc --project ./tsconfig.build.json`,
      hiddenFromHelp: true
    },
    /**
     * Clean files and folders
     */
    clean: {
      default: {
        script: series(`nps banner.clean`, `nps clean.dist`),
        description: 'Deletes the ./dist folder'
      },
      dist: {
        script: rimraf('./dist'),
        hiddenFromHelp: true
      }
    },
    /**
     * Copies static files to the build folder
     */
    copy: {
      default: {
        script: series(),
        // `nps copy.public`
        hiddenFromHelp: true
      },
      public: {
        script: copy('./src/public/*', './dist'),
        hiddenFromHelp: true
      },
      tmp: {
        script: copyDir('./.tmp/src', './dist'),
        hiddenFromHelp: true
      }
    },
    /**
     * Database scripts
     */
    db: {
      migrate: {
        script: series('nps banner.migrate', 'nps config'),
        description: 'Migrates the database to newest version available'
      },
      revert: {
        script: series('nps banner.revert', 'nps config'),
        description: 'Downgrades the database'
      },
      seed: {
        script: series('nps banner.seed', 'nps config', runFast('./commands/seed.ts')),
        description: 'Seeds generated records into the database'
      },
      drop: {
        description: 'Drops the schema of the database'
      },
      setup: {
        script: series('nps db.drop', 'nps db.migrate', 'nps db.seed'),
        description: 'Recreates the database with seeded data'
      }
    },
    /**
     * These run various kinds of tests. Default is unit.
     */
    test: {
      default: 'nps test.unit',
      unit: {
        default: {
          script: series('nps banner.testUnit', 'nps test.unit.pretest', 'nps test.unit.run'),
          description: 'Runs the unit tests'
        },
        pretest: {
          script: 'nps lint',
          hiddenFromHelp: true
        },
        run: {
          script: 'cross-env NODE_ENV=test jest --no-cache --testPathPattern=unit --config=./jest.config.json',
          hiddenFromHelp: true
        },
        verbose: {
          script: 'nps "test --verbose"',
          hiddenFromHelp: true
        },
        coverage: {
          script: 'cross-env NODE_ENV=test jest --testPathPattern=unit --config=./jest.config.json',
          hiddenFromHelp: true
        }
      },
      integration: {
        default: {
          script: series('nps banner.testIntegration', 'nps test.integration.pretest', 'nps test.integration.run'),
          description: 'Runs the integration tests'
        },
        pretest: {
          script: 'nps lint',
          hiddenFromHelp: true
        },
        run: {
          // -i. Run all tests serially in the current process, rather than creating a worker pool of child processes that run tests. This can be useful for debugging.
          script: 'cross-env NODE_ENV=test jest --testPathPattern=integration -i',
          hiddenFromHelp: true
        },
        verbose: {
          script: 'nps "test --verbose"',
          hiddenFromHelp: true
        },
        coverage: {
          script: 'nps "test --coverage"',
          hiddenFromHelp: true
        }
      },
      e2e: {
        default: {
          script: series('nps banner.testE2E', 'nps test.e2e.pretest', 'nps test.e2e.run'),
          description: 'Runs the e2e tests'
        },
        pretest: {
          script: 'nps lint',
          hiddenFromHelp: true
        },
        run: {
          // -i. Run all tests serially in the current process, rather than creating a worker pool of child processes that run tests. This can be useful for debugging.
          script: 'cross-env NODE_ENV=test jest --testPathPattern=e2e -i',
          hiddenFromHelp: true
        },
        verbose: {
          script: 'nps "test --verbose"',
          hiddenFromHelp: true
        },
        coverage: {
          script: 'nps "test --coverage"',
          hiddenFromHelp: true
        }
      }
    },
    /**
     * This creates pretty banner to the terminal
     */
    banner: {
      build: banner('build'),
      serve: banner('serve'),
      testUnit: banner('test.unit'),
      testIntegration: banner('test.integration'),
      testE2E: banner('test.e2e'),
      migrate: banner('migrate'),
      seed: banner('seed'),
      revert: banner('revert'),
      clean: banner('clean')
    }
  }
};

function banner(name) {
  return {
    hiddenFromHelp: true,
    silent: true,
    description: `Shows ${name} banners to the console`,
    script: runFast(`./commands/banner.ts ${name}`)
  };
}

function copy(source, target) {
  return `copyfiles --up 1 ${source} ${target}`;
}

function copyDir(source, target) {
  return `ncp ${source} ${target}`;
}

function run(path) {
  return `ts-node ${path}`;
}

function runFast(path) {
  // Ensure TS path aliases (tsconfig "paths") work for ts-node scripts/commands.
  return `ts-node --transpile-only -r tsconfig-paths/register ${path}`;
}

function tslint(path) {
  return `tslint -c ./tslint.json ${path} --format stylish`;
}
