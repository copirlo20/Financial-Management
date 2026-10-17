import { defineConfig } from "eslint/config";
import nextTs from "eslint-config-next/typescript";

// TypeScript rules only; the React and Next.js rules belong to the frontend.
export default defineConfig([...nextTs]);
