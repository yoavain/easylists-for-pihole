import js from "@eslint/js";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript";
import { createNodeResolver, importX } from "eslint-plugin-import-x";
import jest from "eslint-plugin-jest";
import n from "eslint-plugin-n";
import security from "eslint-plugin-security";
import globals from "globals";

export default [
    {
        files: ["**/*.ts", "**/*.js", "**/*.cjs", "**/*.mjs"],

        plugins: {
            "n": n,
            "@typescript-eslint": typescriptEslint,
            "import-x": importX,
            jest,
            security
        },

        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.jest,
                ...jest.environments.globals.globals,
                Atomics: "readonly",
                SharedArrayBuffer: "readonly"
            },

            parser: tsParser,
            ecmaVersion: 2018,
            sourceType: "commonjs",

            parserOptions: {
                project: "./tsconfig.json"
            }
        },

        settings: {
            "import-x/resolver-next": [
                createTypeScriptImportResolver({ alwaysTryTypes: true }),
                createNodeResolver()
            ]
        },

        rules: {
            ...js.configs.recommended.rules,
            ...n.configs["flat/recommended"].rules,
            ...typescriptEslint.configs["eslint-recommended"].overrides[0].rules,
            ...typescriptEslint.configs.recommended.rules,
            ...security.configs.recommended.rules,
            ...importX.flatConfigs.errors.rules,
            ...importX.flatConfigs.warnings.rules,

            "max-params": ["warn", 6],
            "max-depth": ["error", 4],
            "max-statements-per-line": ["error", { "max": 1 }],
            "max-lines": ["error", { "max": 350, "skipBlankLines": true, "skipComments": true }],
            "max-lines-per-function": ["warn", { "max": 50, "skipBlankLines": true, "skipComments": true }],
            "@typescript-eslint/ban-ts-comment": ["warn"],
            "@typescript-eslint/interface-name-prefix": [0, "never"],
            "arrow-parens": ["error"],
            "quote-props": ["error", "consistent-as-needed", { "numbers": true }],
            "no-unused-vars": "error",
            "no-useless-escape": "error",
            "no-empty-pattern": "error",
            "no-eval": "error",
            "no-implied-eval": "error",
            "no-prototype-builtins": "error",
            "prefer-const": 0,
            "no-process-exit": 0,
            "n/no-sync": 0,
            "n/exports-style": ["error", "module.exports"],
            "n/no-process-exit": 0,
            "n/no-unpublished-require": 0,
            "n/no-extraneous-import": 0,
            "n/no-deprecated-api": ["warn"],
            "n/no-missing-require": [
                "error",
                {
                    "tryExtensions": [".ts", ".js", ".d.ts", ".json", ".node"]
                }
            ],
            "n/no-missing-import": 0,
            "n/no-unpublished-import": 0,
            "n/no-unsupported-features/es-syntax": 0,
            "import-x/extensions": [
                "error",
                {
                    "ts": "never",
                    "js": "never",
                    "json": "always"
                }
            ],
            "import-x/named": "warn",
            "import-x/no-duplicates": "error",
            "import-x/no-unresolved": 0,
            "import-x/default": 0,
            "@typescript-eslint/no-unused-vars": "warn",
            "@typescript-eslint/no-inferrable-types": 0,
            "@typescript-eslint/no-empty-function": 0,
            "@typescript-eslint/no-use-before-define": "warn",
            "@typescript-eslint/no-var-requires": "warn",
            "@typescript-eslint/consistent-type-imports": ["error", { "prefer": "type-imports" }],
            // Style
            "max-len": ["error", { "code": 200 }],
            "indent": ["error", 4, { "SwitchCase": 1 }],
            "quotes": ["error", "double"],
            "semi": ["error", "always"],
            "brace-style": ["error", "stroustrup"],
            "object-curly-spacing": ["error", "always"],
            "no-mixed-spaces-and-tabs": "error",
            "arrow-spacing": ["error"],
            "comma-dangle": ["error", "never"],
            "comma-style": ["error"],
            "no-extra-semi": "error",
            "comma-spacing": "error",
            "space-in-parens": ["error", "never"],
            "space-before-blocks": "error",
            "space-before-function-paren": ["error", { "anonymous": "never", "named": "never", "asyncArrow": "always" }],
            "keyword-spacing": "error",
            "one-var": ["error", "never"]
        }
    },
    {
        files: ["**/*.js"],
        rules: {
            "@typescript-eslint/no-require-imports": 0
        }
    },
    {
        files: ["test/**/*"],
        rules: {
            "no-global-assign": 0
        }
    }
];
