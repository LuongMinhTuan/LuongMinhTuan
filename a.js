import dotenv from 'dotenv';
dotenv.config();
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { ensureLogFiles, logManagerBot } from './src/utils/io-json.js';

const cmdPath = '/usr/bin/bash';
let botProcess;

function startBot() {
    botProcess = spawn(cmdPath, ['-c', 'npm start'], {
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env }
    });

    botProcess.stdout.on('data', data => {
        console.log(`[bot stdout] ${data.toString()}`);
        logManagerBot(`[bot stdout] ${data.toString()}`);
    });

    botProcess.stderr.on('data', data => {
        console.error(`[bot stderr] ${data.toString()}`);
        logManagerBot(`[bot stderr] ${data.toString()}`);
    });

    attachBotEvents(botProcess);
    botProcess.unref();
    logManagerBot('Bot started');
    console.log('Bot started');
}

function stopBot() {
    if (botProcess && botProcess.pid) {
        try {
            process.kill(-botProcess.pid);
            logManagerBot('Bot stopped');
            console.log('Bot stopped');
        } catch (err) {
            if (err.code === 'ESRCH') {
                logManagerBot('No such process to kill (ESRCH)');
                console.log('No such process to kill (ESRCH)');
            } else {
                logManagerBot(`Failed to stop bot: ${err.message}`);
                console.log('Failed to stop bot:', err.message);
            }
        }
    } else {
        logManagerBot('Failed to stop bot: invalid PID');
        console.log('Failed to stop bot: invalid PID');
    }
}

function restartBot() {
    stopBot();
    setTimeout(() => {
        startBot();
        logManagerBot('Bot restarted');
        console.log('Bot restarted');
    }, 1000);
}

function attachBotEvents(botProcess) {
    botProcess.on('error', (err) => {
        logManagerBot(`Bot gặp lỗi: ${err.message}`);
        console.error('Lỗi bot:', err.message);
        restartBot();
    });

    botProcess.on('exit', (code) => {
        logManagerBot(`Bot đã thoát với mã: ${code}`);
        console.log('Bot đã thoát:', code);
        restartBot();
    });
}

process.on('SIGINT', () => {
    logManagerBot('Bot stopped by user (SIGINT). Exiting process...');
    console.log('Bot stopped by user (SIGINT). Exiting process...');
    stopBot();
    process.exit(0);
});

process.on('SIGTERM', () => {
    logManagerBot('Bot stopped (SIGTERM). Restarting...');
    console.log('Bot stopped (SIGTERM). Restarting...');
    restartBot();
});

process.on('exit', () => {
    logManagerBot('Bot process was closed unexpectedly. Restarting after 1 seconds...');
    console.log('Bot process was closed unexpectedly. Restarting after 1 seconds...');
    setTimeout(() => {
        startBot();
    }, 1000);
});

const prophylacticPath = '/root/mt/assets/json-data/prophylactic.json';

function checkAndFixProphylactic(firstRun = false) {
    try {
        if (!fs.existsSync(prophylacticPath)) {
            const msg = `[prophylactic] File không tồn tại: ${prophylacticPath}`;
            logManagerBot(msg);
            console.log(msg);
            return;
        }

        const data = JSON.parse(fs.readFileSync(prophylacticPath, 'utf8'));

        if (data.prophylacticUploadAttachment?.enable === true) {
            const msg = `[prophylactic] ${firstRun ? 'First run check' : 'Periodic check'} → enable = true → set lại false`;
            logManagerBot(msg);
            console.log(msg);
            data.prophylacticUploadAttachment.enable = false;
            fs.writeFileSync(prophylacticPath, JSON.stringify(data, null, 2));
        } else {
            const msg = `[prophylactic] ${firstRun ? 'First run check' : 'Periodic check'} → enable đã là false`;
            logManagerBot(msg);
            console.log(msg);
        }
    } catch (err) {
        const msg = `[prophylactic] Lỗi khi xử lý file: ${err.message}`;
        logManagerBot(msg);
        console.error(msg);
    }
}

ensureLogFiles();
checkAndFixProphylactic(true);
startBot();

setInterval(() => {
    checkAndFixProphylactic(false);
}, 300000);
