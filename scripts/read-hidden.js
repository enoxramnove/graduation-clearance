function readHidden(prompt) {
    if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
        return Promise.reject(new Error('Run this command in an interactive terminal.'));
    }

    return new Promise((resolve, reject) => {
        let value = '';
        const cleanup = () => {
            process.stdin.removeListener('data', onData);
            process.stdin.setRawMode(false);
            process.stdin.pause();
            process.stdout.write('\n');
        };
        const onData = (key) => {
            if (key === '\u0003') {
                cleanup();
                reject(new Error('Password entry cancelled.'));
            } else if (key === '\r' || key === '\n') {
                cleanup();
                resolve(value);
            } else if (key === '\u007f' || key === '\b') {
                if (value.length > 0) {
                    value = value.slice(0, -1);
                    process.stdout.write('\b \b');
                }
            } else if (key >= ' ') {
                value += key;
                process.stdout.write('*');
            }
        };

        process.stdout.write(prompt);
        process.stdin.setEncoding('utf8');
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.on('data', onData);
    });
}

module.exports = readHidden;
