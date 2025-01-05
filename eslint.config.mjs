import typescriptEslintPlugin from "@typescript-eslint/eslint-plugin";
import typescriptEslintParser from "@typescript-eslint/parser";
import prettierPlugin from "eslint-plugin-prettier";

export default [
    {
        files: ["**/*.ts", "**/*.js"],
        ignores: [
            "*.md",
            "yarn.lock",
            ".env",
            "./src/abis",
            "*.json",
            "node_modules",
            "artifacts",
            "cache",
            "contracts",
            "docs",
            "dist"
        ],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            parser: typescriptEslintParser
        },
        plugins: {
            "@typescript-eslint": typescriptEslintPlugin,
            prettier: prettierPlugin
        },
        rules: {
            "no-empty": "off",
            "no-undef": "off",
            "no-console": "error",
            "prefer-const": "error",
            "no-trailing-spaces": "error",
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-non-null-assertion": "off",
            "@typescript-eslint/no-var-requires": "off",
            "@typescript-eslint/no-empty-function": "off",
            "semi": ["error", "always"],
            "prettier/prettier": [
                "error",
                {
                    "printWidth": 100,
                    "tabWidth": 4
                }
            ]
        }
    }
];
