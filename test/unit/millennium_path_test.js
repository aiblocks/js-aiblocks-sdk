describe('millennium path tests', function() {
  beforeEach(function() {
    this.axiosMock = sinon.mock(MillenniumAxiosClient);
    AiBlocksSdk.Config.setDefault();
  });

  afterEach(function() {
    this.axiosMock.verify();
    this.axiosMock.restore();
  });

  function test_millennium_paths(serverUrl) {
    let server = new AiBlocksSdk.Server(serverUrl);

    let randomResult = {
      data: {
        url: serverUrl,
        random: Math.round(1000 * Math.random()),
        endpoint: 'bogus'
      }
    };

    function prepareAxios(axiosMock, endpoint) {
      randomResult.endpoint = endpoint;
      axiosMock
        .expects('get')
        .withArgs(sinon.match(serverUrl + endpoint))
        .returns(Promise.resolve(randomResult));
    }

    it('server.accounts() ' + serverUrl, function(done) {
      prepareAxios(this.axiosMock, '/accounts');
      server
        .accounts()
        .call()
        .should.eventually.deep.equal(randomResult.data)
        .notify(done);
    });

    it("server.accounts().accountId('fooAccountId') " + serverUrl, function(
      done
    ) {
      prepareAxios(this.axiosMock, '/accounts/fooAccountId');
      server
        .accounts()
        .accountId('fooAccountId')
        .call()
        .should.eventually.deep.equal(randomResult.data)
        .notify(done);
    });

    it('server.transactions() ' + serverUrl, function(done) {
      prepareAxios(this.axiosMock, '/transactions');
      server
        .transactions()
        .call()
        .should.eventually.deep.equal(randomResult.data)
        .notify(done);
    });

    it('server.transactions().includeFailed(true) ' + serverUrl, function(
      done
    ) {
      prepareAxios(this.axiosMock, '/transactions?include_failed=true');
      server
        .transactions()
        .includeFailed(true)
        .call()
        .should.eventually.deep.equal(randomResult.data)
        .notify(done);
    });

    it('server.operations().includeFailed(true) ' + serverUrl, function(done) {
      prepareAxios(this.axiosMock, '/operations?include_failed=true');
      server
        .operations()
        .includeFailed(true)
        .call()
        .should.eventually.deep.equal(randomResult.data)
        .notify(done);
    });

    it(
      "server.transactions().transaction('fooTransactionId') " + serverUrl,
      function(done) {
        prepareAxios(this.axiosMock, '/transactions/fooTransactionId');
        server
          .transactions()
          .transaction('fooTransactionId')
          .call()
          .should.eventually.deep.equal(randomResult.data)
          .notify(done);
      }
    );

    it(
      "server.transactions().forAccount('fooAccountId') " + serverUrl,
      function(done) {
        prepareAxios(this.axiosMock, '/accounts/fooAccountId/transactions');
        server
          .transactions()
          .forAccount('fooAccountId')
          .call()
          .should.eventually.deep.equal(randomResult.data)
          .notify(done);
      }
    );

    it('server.submitTransaction() ' + serverUrl, function(done) {
      randomResult.endpoint = 'post';

      let keypair = AiBlocksSdk.Keypair.random();
      let account = new AiBlocksSdk.Account(
        keypair.publicKey(),
        '56199647068161'
      );

      let fakeTransaction = new AiBlocksSdk.TransactionBuilder(account, {
        fee: 100,
        networkPassphrase: AiBlocksSdk.Networks.TESTNET
      })
        .addOperation(
          AiBlocksSdk.Operation.payment({
            destination: keypair.publicKey(),
            asset: AiBlocksSdk.Asset.native(),
            amount: '100.50'
          })
        )
        .setTimeout(AiBlocksSdk.TimeoutInfinite)
        .build();
      fakeTransaction.sign(keypair);
      let tx = encodeURIComponent(
        fakeTransaction
          .toEnvelope()
          .toXDR()
          .toString('base64')
      );

      this.axiosMock
        .expects('post')
        .withArgs(sinon.match(serverUrl + '/transactions', `tx=${tx}`))
        .returns(Promise.resolve(randomResult));

      server
        .submitTransaction(fakeTransaction, {skipMemoRequiredCheck: true})
        .should.eventually.deep.equal(randomResult.data)
        .notify(done);
    });
  }

  let serverUrls = [];

  //server url without folder path.
  serverUrls.push('https://acme.com:1337');

  //server url folder path.
  serverUrls.push('https://acme.com:1337/folder');

  //server url folder and subfolder path.
  serverUrls.push('https://acme.com:1337/folder/subfolder');

  for (var index = 0; index < serverUrls.length; index++) {
    var serverUrl = serverUrls[index];
    test_millennium_paths(serverUrl);
  }
});
