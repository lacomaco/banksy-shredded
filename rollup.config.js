import typescript from "rollup-plugin-typescript2";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import {string} from "rollup-plugin-string";

export default {
  input: "src/frontend/index.ts",
  output: {
    file: "dist/frontend/bundle.js",
    format: "esm",
    sourcemap: true,
  },
  plugins: [
    typescript({ tsconfig: './tsconfig.frontend.json' }),
    resolve({
      browser: true,
      preferBuiltins: false,
    }),
    commonjs(),
    json(),
    string({
      include: "**/*.wgsl",
      exclude: ["**/index.html"]
    })
  ],
};