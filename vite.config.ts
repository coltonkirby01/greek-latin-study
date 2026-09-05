import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function pagesBase() {
  if (process.env.VITE_BASE_PATH) return process.env.VITE_BASE_PATH;
  if (process.env.GITHUB_ACTIONS === "true" && process.env.GITHUB_REPOSITORY) {
    const repositoryName = process.env.GITHUB_REPOSITORY.split("/").at(-1);
    if (repositoryName) return `/${repositoryName}/`;
  }
  return "/";
}

export default defineConfig({
  plugins: [react()],
  base: pagesBase(),
});
