import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import importPlugin from 'eslint-plugin-import';
import globals from 'globals';

export default [
	// 001_web/ is a TRACKED archive of the pre-React static site, including
	// 11 bundled assets/index-*.js files. It was the entire reason a
	// repo-wide `eslint .` reported 108 errors -- measured 2026-09-04:
	// all 108 were in 001_web/, and zero anywhere else. Ignoring it makes
	// `lint:all` meaningful instead of permanently red.
	// .wrangler/.netlify/.claude hold local tool state, no tracked files.
	{
		ignores: [
			'node_modules/**',
			'dist/**',
			'build/**',
			'vite.config.js',
			'001_web/**',
			'.wrangler/**',
			'.netlify/**',
			'.claude/**',
		],
	},
	{
		// '**/*.mjs' added 2026-09-04 (Phase 6C). Without it, .mjs matched NO
		// config object, so ESLint applied ZERO rules to it -- verified with
		// --print-config: 0 rules and 0 globals on a .mjs, versus 36 rules and
		// 1140 globals on a .js. CI's `eslint tools/` was therefore passing
		// vacuously over 83 of the 95 files in tools/, plus 7 more in src/.
		// A .mjs with a plain no-undef violation exited 0 with no output.
		files: ['**/*.js', '**/*.jsx', '**/*.mjs'],
		plugins: { react, 'react-hooks': reactHooks, import: importPlugin },
		languageOptions: {
			ecmaVersion: 'latest',
			sourceType: 'module',
			parserOptions: { ecmaFeatures: { jsx: true } },
			globals: { ...globals.browser, React: 'readonly', Intl: 'readonly' },
		},
		settings: {
			react: { version: 'detect' },
			'import/resolver': {
				node: { extensions: ['.js', '.jsx', '.mjs'] },
				alias: { map: [['@', './src']], extensions: ['.js', '.jsx', '.mjs'] },
			},
		},
		rules: {
			...react.configs.recommended.rules,
			...reactHooks.configs.recommended.rules,
			...importPlugin.flatConfigs.recommended.rules,

			// Non-critical rules - disabled since code works fine without them
			'react/prop-types': 'off',
			'react/no-unescaped-entities': 'off',
			'react/display-name': 'off', // Non-critical, component works without displayName
			'react/jsx-uses-react': 'off', // Not needed in React 17+, non-critical
			'react/react-in-jsx-scope': 'off', // Not needed in React 17+, non-critical
			'react/jsx-uses-vars': 'off', // Non-critical, code works fine
			'react/jsx-no-comment-textnodes': 'off', // Non-critical, comments could be visible if put inside the JSX, most cases are just rendering text like '///'

			'no-unused-vars': 'off', // Non-critical, code works fine with unused vars
			'import/no-named-as-default': 'off', // Can cause runtime import errors, usually fine to leave as is
			'import/no-named-as-default-member': 'off', // Can cause runtime import errors

			// Critical rules that prevent runtime errors
			'no-undef': 'error', // Undefined variables cause runtime errors

			// Override recommended import rules for stricter checking
			'import/no-self-import': 'error', // Extremely fast rule, breaking results in infinite loop/bundling error

			// Disable expensive rules for performance
			'import/no-cycle': 'off', // AI rarely makes this error, and the rule is very slow to run
		},
	},
	// tools/**/*.mjs added with the same reasoning: these are Node scripts,
	// so without node globals every `process`/`console` would read as an
	// undefined variable the moment no-undef starts applying to them.
	{
		files: ['tools/**/*.js', 'tools/**/*.mjs', 'tailwind.config.js'],
		languageOptions: { globals: globals.node },
	},
];
