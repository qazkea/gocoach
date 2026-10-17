import {defineConfig} from "@playwright/test";
const port=process.env.GO_COACH_TEST_PORT??'5173';
const baseURL=`http://127.0.0.1:${port}`;
export default defineConfig({testDir:"./tests",fullyParallel:true,use:{baseURL},webServer:{command:`npm.cmd run dev -- --port ${port}`,url:baseURL,reuseExistingServer:false},reporter:"list"});
