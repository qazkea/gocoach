import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'.',testMatch:'startup-failure.case.ts',timeout:35000,reporter:'list'});
