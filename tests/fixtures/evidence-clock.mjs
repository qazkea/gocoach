// External platform clock adapter: offset only monotonic performance.now in the
// isolated test service. Never included in the application bundle or HTTP input.
import {readFileSync} from 'node:fs';
const now=performance.now.bind(performance);
Object.defineProperty(performance,'now',{value:()=>now()+Number(readFileSync(process.env.EVIDENCE_CLOCK_FILE,'utf8'))});
