module.exports.logError = err => {
    console.error((new Date).toUTCString() + ':', err.message);
    console.error(err.stack);
};
