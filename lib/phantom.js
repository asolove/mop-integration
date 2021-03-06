var spawn = require("child_process").spawn;
var Q = require("q");
var wd = require("wd");
var SearchStream = require("./search-stream");

/**
 * Starts up PhantomJS with a webdriver interface
 * @return {Promise<wd>} Promise for an initialized browser from wd.js
 */
module.exports = function phantom() {
    var started = Q.defer();

    var phantomProc = spawn("phantomjs", ["--webdriver=127.0.0.1:8910"], {
        stdio: ['ignore', 'pipe', global.DEBUG ? process.stderr : 'ignore']
    });

    // GhostDriver is ready to recieve commands after this text has appeared
    // in the output stream
    phantomProc.stdio[1].pipe(new SearchStream({
        match: "GhostDriver - Main - running",
        matchedCallback: started.resolve,
        out: global.DEBUG ? process.stdout : void 0
    }));

    var browser = wd.promiseRemote("127.0.0.1", 8910);

    // Kill phantom when the browser is quit
    var originalQuit = browser.quit;
    browser.quit = function () {
        return originalQuit.call(browser)
        .finally(function () {
            var killed = Q.defer();

            phantomProc.on('close', function (code, signal) {
                killed.resolve();
            });
            phantomProc.on('error', function (error) {
                killed.reject(error);
            });

            phantomProc.kill();

            return killed.promise;
        });
    };

    return started.promise
    .timeout(10000, "Timeout waiting for PhantomJS to start")
    .then(function () {
        return browser.init();
    })
    .fail(function (error) {
        phantomProc.kill();
        throw error;
    })
    .then(function () {
        return browser;
    });
};
