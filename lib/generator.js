'use strict';

const fs = require('fs');
const EventEmitter = require('events').EventEmitter;
const url = require('url');

const CleanCSS = require('clean-css');
const filterCss = require('filter-css');
const oust = require('oust');
const penthouse = require('penthouse');
const request = require('request');
const tempfile = require('tempfile');
const uuid = require('uuid');

const logError = require('./log').logError;

function download(resourceUrl) {
    return new Promise((resolve, reject) => {
        let opts = {
            url: resourceUrl,
            strictSSL: false,
            headers: {
                'User-Agent': 'ccsss'
            }
        };
        request(opts, (err, response, body) => {
            if (err) reject(err);
            else resolve(body);
        });
    });
}

function concatCss(cssContentsAsStringsOrNot) {
    return cssContentsAsStringsOrNot.map(c => c.toString()).join(' ')
}

function fetchCss(pageUrl, dest) {
    return download(pageUrl)
        .then(html => {
            if (html.toLowerCase().indexOf('<html') === -1) {
                throw new Error('No HTML received');
            }
            return oust(html, 'stylesheets');
        })
        .then(cssLinks => cssLinks.map(l => url.resolve(pageUrl, l)))
        .then(cssLinks => Promise.all(cssLinks.map(download)))
        .then(concatCss)
        .then(css => {
            if (!css) {
                return false;
            }
            return new Promise((resolve, reject) => {
                fs.writeFile(dest, css, err => {
                    if (err) reject(err);
                    else resolve(true);
                })
            });
        });
}

function combineCss(cssContents) {
    return new CleanCSS({mediaMerging: true})
        .minify(concatCss(cssContents))
        .styles;
}

function toRegExpArray(regExpsAsStrings) {
    return (regExpsAsStrings || []).map(re => new RegExp(re));
}

function cssFilterFor(cfg) {
    let filters = (cfg.ignore || []).concat(toRegExpArray(cfg.ignoreRe));
    return css => filters.length ?
            new CleanCSS().minify(filterCss(css, filters)).styles :
            css;
}

function callPenthouse(cfg, cssFile, dimensions) {
    let forceInclude = (cfg.forceInclude || []).concat(toRegExpArray(cfg.forceIncludeRe));

    return new Promise((resolve, reject) => {
        penthouse({
            url: cfg.url,
            css: cssFile,
            forceInclude: forceInclude,
            maxEmbeddedBase64Length: cfg.maxImageFileSize || 10240,
            width: dimensions.width,
            height: dimensions.height,
            phantomJsOptions: cfg.phantomJsOptions
        }, (err, criticalCss) => {
            if (err) reject(err);
            else resolve(criticalCss);
        });
    });
}

function generateCriticalCss(cfg) {
    let cssFile = tempfile('.css');
    let cleanCssFileAfterOperation = false;

    return fetchCss(cfg.url, cssFile)
        .then(cssWritten => {
            cleanCssFileAfterOperation = cssWritten;
            let promisesForEachDimension = cfg.dimensions.map(dim => callPenthouse(cfg, cssFile, dim));
            return Promise.all(promisesForEachDimension);
        })
        .then(combineCss)
        .then(cssFilterFor(cfg))
        .then(criticalCss => {
            if (cleanCssFileAfterOperation) {
                fs.unlink(cssFile); // don't wait for it
            }
            return criticalCss;
        }, err => {
            if (cleanCssFileAfterOperation) {
                fs.unlink(cssFile); // don't wait for it
            }
            throw err;
        });
}


class CriticalCssGenerator extends EventEmitter {
    constructor() {
        super();
        this.requestsQueue = [];
        this.processing = false;
    }

    enqueue(generationRequest) {
        let generationId = uuid.v4();
        generationRequest.generationId = generationId;
        this.requestsQueue.push(generationRequest);

        if (!this.processing) {
            setTimeout(this._processNextRequest.bind(this), 1);
        }

        return generationId;
    }

    _processNextRequest() {
        if (this.processing) {
            return;
        }

        this.processing = true;

        try {
            this._unsafeProcessNextRequest()
                .then(() => {
                    this._endProcessing();
                }, err => {
                    logError(err);
                    this._endProcessing();
                });
        } catch (e) {
            logError(e);
            this._endProcessing();
        }
    }

    _unsafeProcessNextRequest() {
        let cfg = this.requestsQueue.shift();
        return generateCriticalCss(cfg)
            .then(criticalCss => this.emit('critical-css-generated', cfg, criticalCss));
    }

    _endProcessing() {
        this.processing = false;
        if (this.requestsQueue.length) {
            setTimeout(this._processNextRequest.bind(this), 1);
        }
    }
}

module.exports = CriticalCssGenerator;
