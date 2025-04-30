import { defineConfig } from "vite";
import pluginCommonjs from "vite-plugin-commonjs";
import copy from "rollup-plugin-copy";

const commonjs = pluginCommonjs();
commonjs.apply = undefined;

// https://vitejs.dev/config
export default defineConfig({
  plugins: [
    commonjs,
    copy({
      targets: [{ src: "assets/itunes-bridge-script/*", dest: ".vite/build" }],
    }),
  ],
});
