'use strict';

const http = require('http');

const expect = require('chai').expect;
const getPort = require('getport');
const request = require('supertest');

const ccsss = require('../lib/server');

function waitFor(predicate) {
    return new Promise(resolve => {
        (function testPredicate() {
            if (predicate()) {
                return resolve();
            }
            setTimeout(testPredicate, 10);
        })();
    });
}

describe('ccsss', () => {
    let ccsssAppUrl, ccsssServer, fakeAppUrl, fakeAppServer, receivedNotification;

    function fakeAppRequestHandler(req, response) {
        if (req.method === 'GET' && req.url === '/some-style.css') {
            response.writeHead(200, {'Content-Type': 'text/css'});
            response.end(`
                .blue { color: blue; }
                .red { color: red; }
                .thick { font-weight: bold; }
                .underlined { text-decoration: underline; }
                .small-margin { margin: 2px; }
                .big-margin { padding: 50px; }
            `);
            return;
        }

        if (req.method === 'GET' && req.url === '/page') {
            response.writeHead(200, {'Content-Type': 'text/html'});
            response.end('<html>' +
                '<body>' +
                '<link rel="stylesheet" href="some-style.css"' +
                '</body>' +
                '<body>' +
                '<p class="blue thick underlined">I\'m a blue thick underlined paragraph</p>' +
                '</body>' +
                '</html>'
            );
            return;
        }

        if (req.method === 'POST' && req.url === '/notification') {
            let body = [];
            req.on('data', chunk => {
                body.push(chunk);
            });
            req.on('end', () => {
                receivedNotification = JSON.parse(Buffer.concat(body).toString());
                response.statusCode = 200;
                response.end();
            });
            return;
        }

        response.statusCode = 500;
        response.end("I'm a dumb server, don't know how to process that request.");
    }

    beforeEach(done => {
        getPort((err1, port1) => {
            if (err1) {
                return done(err1);
            }

            ccsssAppUrl = 'http://localhost:' + port1;
            ccsssServer = ccsss.start(port1, () => {
                getPort((err2, port2) => {
                    if (err2) {
                        return done(err2);
                    }

                    fakeAppUrl = 'http://localhost:' + port2;
                    receivedNotification = null;
                    fakeAppServer = http.createServer(fakeAppRequestHandler).listen(port2, done);
                });
            });
        });
    });

    afterEach(done => {
        if (fakeAppServer) {
            fakeAppServer.close(() => {
                ccsssServer.stop(done);
            })
        }
        else if (ccsssServer) {
            ccsssServer.stop(done);
        }
    });

    it('should process request asynchronously and then notify and expose result when ready', function (done) {
        let generationId;

        request(ccsssAppUrl)
            .post('/generation/request')
            .send({
                url: fakeAppUrl + '/page',
                dimensions: [{
                    width: 800,
                    height: 600
                }],
                forceInclude: ['.small-margin'],
                forceIncludeRe: ['.big.*gin'],
                ignore: ['.thick'],
                ignoreRe: ['.*under.*'],
                notificationUrl: fakeAppUrl + '/notification',
                phantomJsOptions: {
                    'ssl-protocol': 'SSLv2'
                }
            })
            .expect(202)
            .expect('Content-Type', 'application/json')
            .expect(res => {
                expect(res.body.generationId).to.be.a('string');
                expect(res.body.status).to.equal('pending');
                generationId = res.body.generationId;
            })
            .end(err => {
                if (err) {
                    return done(err);
                }

                waitFor(() => !!receivedNotification)
                    .then(() => {
                        expect(receivedNotification.generationId).to.equal(generationId);
                        expect(receivedNotification.status).to.equal('success');
                        expect(receivedNotification.resultLocation).to.equal(ccsssAppUrl + '/generation/result/' + generationId);
                    })
                    .then(() => {
                        return new Promise((resolve, reject) => {
                            request(ccsssAppUrl)
                                .get('/generation/result/' + generationId)
                                .expect(200)
                                .expect('Content-Type', 'text/css; charset=UTF-8')
                                .expect('.blue{color:#00f}.small-margin{margin:2px}.big-margin{padding:50px}')
                                .end(err => {
                                    if (err) reject(err);
                                    else resolve();
                                })
                        });
                    })
                    .then(done, done);
            });
    });

    it('should reject a bad request and give an example of a valid one', function (done) {
        request(ccsssAppUrl)
            .post('/generation/request')
            .send({
                bad: 'request'
            })
            .expect(400)
            .expect('Content-Type', 'application/json')
            .expect(res => {
                expect(res.body.exampleOfValidRequest).to.be.an('object');
            })
            .end(done);
    });

    it('should respond 200 once launched', function(done) {
        request(ccsssAppUrl)
            .get('/health')
            .expect(200)
            .expect('Content-Type', 'application/json')
            .expect(res => {
                expect(res.body.status).to.equal("UP");
            })
            .end(done);
    });
});
