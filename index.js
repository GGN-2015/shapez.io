const { app, BrowserWindow, Menu, dialog } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');
const { fork } = require('child_process');

// Global variables
let gulpChildProcess = null;
let mainWindow = null; // Store main window reference
const serverUrl = 'http://localhost:3005';
const checkInterval = 2000;
let checkTimer = null;

// Create temporary waiting page
const waitingHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Loading...</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            background-color: #f0f0f0;
            font-family: Arial, sans-serif;
            font-size: 20px;
            color: #333;
        }
        .spinner {
            border: 5px solid #f3f3f3;
            border-top: 5px solid #3498db;
            border-radius: 50%;
            width: 50px;
            height: 50px;
            animation: spin 1s linear infinite;
            margin-right: 20px;
        }
        .error {
            color: #e74c3c;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .container {
            display: flex;
            align-items: center;
            flex-direction: column;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="spinner"></div>
        <div id="status">Waiting for Server to initialize ....</div>
    </div>
</body>
</html>
`;

const waitingPagePath = path.join(__dirname, 'waiting.html');
fs.writeFileSync(waitingPagePath, waitingHtml);

// Handle Gulp process exit
function handleGulpExit(exitCode) {
    console.log(`Gulp process exited with code: ${exitCode}`);

    // Stop server check if running
    if (checkTimer) {
        clearInterval(checkTimer);
        checkTimer = null;
        console.log('Server check stopped because Gulp process exited');
    }

    // Update UI if window exists
    if (mainWindow && mainWindow.webContents) {
        // Show error message in waiting page
        mainWindow.webContents.executeJavaScript(`
            document.getElementById('status').textContent = 'Gulp process has exited. Cannot start server.';
            document.getElementById('status').classList.add('error');
            document.querySelector('.spinner').style.display = 'none';
        `).catch(err => console.error('Failed to update UI:', err));

        // Show system dialog
        dialog.showErrorBox(
            'Server Start Failed',
            `Gulp process exited unexpectedly (code: ${exitCode}).\nThe application cannot continue.`
        );
    }

    // Exit app after short delay
    setTimeout(() => {
        app.quit();
    }, 3000);
}

// Start Gulp child process
function startGulpTask() {
    const gulpDir = path.join(__dirname, 'gulp');
    const gulpfilePath = path.join(gulpDir, 'gulpfile.js');

    if (!fs.existsSync(gulpDir)) {
        console.error(`Gulp directory does not exist: ${gulpDir}`);
        dialog.showErrorBox('Fatal Error', `Gulp directory not found: ${gulpDir}`);
        app.quit();
        return;
    }

    if (!fs.existsSync(gulpfilePath)) {
        console.error(`Gulpfile does not exist: ${gulpfilePath}`);
        dialog.showErrorBox('Fatal Error', `Gulpfile not found: ${gulpfilePath}`);
        app.quit();
        return;
    }

    gulpChildProcess = fork(gulpfilePath, [], {
        cwd: gulpDir,
        stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
        env: { ...process.env, NODE_ENV: 'development' }
    });

    gulpChildProcess.stdout.on('data', (data) => {
        console.log(`Gulp Log: ${data.toString().trim()}`);
    });

    gulpChildProcess.stderr.on('data', (data) => {
        console.error(`Gulp Error: ${data.toString().trim()}`);
    });

    // Critical: Monitor Gulp exit and trigger handling
    gulpChildProcess.on('exit', handleGulpExit);

    gulpChildProcess.on('error', (err) => {
        console.error(`Gulp failed to start: ${err.message}`);
        dialog.showErrorBox('Gulp Start Failed', err.message);
        app.quit();
    });
}

// Check server availability
function checkServerAvailability() {
    return new Promise((resolve) => {
        const parsedUrl = new URL(serverUrl);
        const request = http.request({
            hostname: parsedUrl.hostname,
            port: parsedUrl.port,
            path: parsedUrl.pathname,
            timeout: 1000
        }, (res) => {
            resolve(res.statusCode >= 200 && res.statusCode < 400);
        });

        request.on('error', () => resolve(false));
        request.end();
    });
}

// Create main window
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1024,
        height: 768,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    Menu.setApplicationMenu(null);
    mainWindow.loadFile(waitingPagePath);

    // Start server check
    checkTimer = setInterval(async () => {
        // Only check if Gulp process is still running
        if (!gulpChildProcess) {
            return;
        }

        const isAvailable = await checkServerAvailability();
        if (isAvailable) {
            console.log('Server is ready, loading server page');
            mainWindow.loadURL(serverUrl);
            clearInterval(checkTimer);
            checkTimer = null;

            // Clean up temporary file
            try {
                if (fs.existsSync(waitingPagePath)) {
                    fs.unlinkSync(waitingPagePath);
                }
            } catch (err) {
                console.log('Failed to clean up temporary file:', err);
            }
        } else {
            console.log('Server is not ready, continuing to wait...');
        }
    }, checkInterval);

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// App lifecycle
app.whenReady().then(() => {
    startGulpTask();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (checkTimer) clearInterval(checkTimer);
    if (gulpChildProcess) {
        gulpChildProcess.kill();
    }

    try {
        if (fs.existsSync(waitingPagePath)) {
            fs.unlinkSync(waitingPagePath);
        }
    } catch (err) {
        console.log('Failed to clean up temporary file on exit:', err);
    }

    if (process.platform !== 'darwin') {
        app.quit();
    }
});
