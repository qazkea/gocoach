import {defineConfig} from "@playwright/test";
export default defineConfig({testDir:"./tests",fullyParallel:true,use:{baseURL:"http://127.0.0.1:5173"},webServer:{command:"npm.cmd run dev",url:"http://127.0.0.1:5173",reuseExistingServer:false},reporter:"list"});
