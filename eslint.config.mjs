import { defineConfig, globalIgnores } from "eslint/config";
import nextTs from "eslint-config-next/typescript";

// For what lives at the repository root (tests, scripts). Each package has its own config.
export default defineConfig([...nextTs, globalIgnores(["frontend/**", "backend/**", "database/**", "shared/**"])]);
