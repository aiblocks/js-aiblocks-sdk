const http = require('http');

describe('aiblocks_toml_resolver.js tests', function() {
  beforeEach(function() {
    this.axiosMock = sinon.mock(axios);
    AiBlocksSdk.Config.setDefault();
  });

  afterEach(function() {
    this.axiosMock.verify();
    this.axiosMock.restore();
  });

  describe('AiBlocksTomlResolver.resolve', function() {
    afterEach(function() {
      AiBlocksSdk.Config.setDefault();
    });

    it('returns aiblocks.toml object for valid request and aiblocks.toml file', function(done) {
      this.axiosMock
        .expects('get')
        .withArgs(sinon.match('https://acme.com/.well-known/aiblocks.toml'))
        .returns(
          Promise.resolve({
            data: `
#   The endpoint which clients should query to resolve aiblocks addresses
#   for users on your domain.
FEDERATION_SERVER="https://api.aiblocks.io/federation"
`
          })
        );

      AiBlocksSdk.AiBlocksTomlResolver.resolve('acme.com').then((aiblocksToml) => {
        expect(aiblocksToml.FEDERATION_SERVER).equals(
          'https://api.aiblocks.io/federation'
        );
        done();
      });
    });

    it('returns aiblocks.toml object for valid request and aiblocks.toml file when allowHttp is `true`', function(done) {
      this.axiosMock
        .expects('get')
        .withArgs(sinon.match('http://acme.com/.well-known/aiblocks.toml'))
        .returns(
          Promise.resolve({
            data: `
#   The endpoint which clients should query to resolve aiblocks addresses
#   for users on your domain.
FEDERATION_SERVER="http://api.aiblocks.io/federation"
`
          })
        );

      AiBlocksSdk.AiBlocksTomlResolver.resolve('acme.com', {
        allowHttp: true
      }).then((aiblocksToml) => {
        expect(aiblocksToml.FEDERATION_SERVER).equals(
          'http://api.aiblocks.io/federation'
        );
        done();
      });
    });

    it('returns aiblocks.toml object for valid request and aiblocks.toml file when global Config.allowHttp flag is set', function(done) {
      AiBlocksSdk.Config.setAllowHttp(true);

      this.axiosMock
        .expects('get')
        .withArgs(sinon.match('http://acme.com/.well-known/aiblocks.toml'))
        .returns(
          Promise.resolve({
            data: `
#   The endpoint which clients should query to resolve aiblocks addresses
#   for users on your domain.
FEDERATION_SERVER="http://api.aiblocks.io/federation"
`
          })
        );

      AiBlocksSdk.AiBlocksTomlResolver.resolve('acme.com').then((aiblocksToml) => {
        expect(aiblocksToml.FEDERATION_SERVER).equals(
          'http://api.aiblocks.io/federation'
        );
        done();
      });
    });

    it('rejects when aiblocks.toml file is invalid', function(done) {
      this.axiosMock
        .expects('get')
        .withArgs(sinon.match('https://acme.com/.well-known/aiblocks.toml'))
        .returns(
          Promise.resolve({
            data: `
/#   The endpoint which clients should query to resolve aiblocks addresses
#   for users on your domain.
FEDERATION_SERVER="https://api.aiblocks.io/federation"
`
          })
        );

      AiBlocksSdk.AiBlocksTomlResolver.resolve('acme.com')
        .should.be.rejectedWith(/Parsing error on line/)
        .and.notify(done);
    });

    it('rejects when there was a connection error', function(done) {
      this.axiosMock
        .expects('get')
        .withArgs(sinon.match('https://acme.com/.well-known/aiblocks.toml'))
        .returns(Promise.reject());

      AiBlocksSdk.AiBlocksTomlResolver.resolve(
        'acme.com'
      ).should.be.rejected.and.notify(done);
    });

    it('fails when response exceeds the limit', function(done) {
      // Unable to create temp server in a browser
      if (typeof window != 'undefined') {
        return done();
      }
      var response = Array(AiBlocksSdk.AIBLOCKS_TOML_MAX_SIZE + 10).join('a');
      let tempServer = http
        .createServer((req, res) => {
          res.setHeader('Content-Type', 'text/x-toml; charset=UTF-8');
          res.end(response);
        })
        .listen(4444, () => {
          AiBlocksSdk.AiBlocksTomlResolver.resolve('localhost:4444', {
            allowHttp: true
          })
            .should.be.rejectedWith(
              /aiblocks.toml file exceeds allowed size of [0-9]+/
            )
            .notify(done)
            .then(() => tempServer.close());
        });
    });

    it('rejects after given timeout when global Config.timeout flag is set', function(done) {
      AiBlocksSdk.Config.setTimeout(1000);

      // Unable to create temp server in a browser
      if (typeof window != 'undefined') {
        return done();
      }

      let tempServer = http
        .createServer((req, res) => {
          setTimeout(() => {}, 10000);
        })
        .listen(4444, () => {
          AiBlocksSdk.AiBlocksTomlResolver.resolve('localhost:4444', {
            allowHttp: true
          })
            .should.be.rejectedWith(/timeout of 1000ms exceeded/)
            .notify(done)
            .then(() => {
              AiBlocksSdk.Config.setDefault();
              tempServer.close();
            });
        });
    });

    it('rejects after given timeout when timeout specified in AiBlocksTomlResolver opts param', function(done) {
      // Unable to create temp server in a browser
      if (typeof window != 'undefined') {
        return done();
      }

      let tempServer = http
        .createServer((req, res) => {
          setTimeout(() => {}, 10000);
        })
        .listen(4444, () => {
          AiBlocksSdk.AiBlocksTomlResolver.resolve('localhost:4444', {
            allowHttp: true,
            timeout: 1000
          })
            .should.be.rejectedWith(/timeout of 1000ms exceeded/)
            .notify(done)
            .then(() => tempServer.close());
        });
    });
  });
});
