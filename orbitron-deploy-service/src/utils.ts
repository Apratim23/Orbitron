import {exec, spawn} from 'child_process';
import path from 'path';

export function buildProject(id: string) {
    return new Promise((resolve) => {
        const dir = path.join(__dirname, `output/${id}`);
        console.log("Build working dir:", dir);

        const child = exec(`npm install && npm run build`, { cwd: dir });

        child.stdout?.on('data', function (data) {
            console.log('stdout:' + data);
        });

        child.stderr?.on('data', function (data) {
            console.error('stderr:' + data);
        });

        child.on('close', function (code) {
            console.log(`child process exited with code ${code}`);
            resolve(code === 0);
        });
    });
}
