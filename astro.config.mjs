// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config

export default defineConfig({
 site: 'https://qamareth-srd.pages.dev',
 output: 'static',
 trailingSlash: 'never',
 build: {
   format: 'directory',      // FIX: every folder gets index.html
 }
});