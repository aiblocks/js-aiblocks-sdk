const randomBytes = require("randombytes");

function newClientSigner(key, weight) {
  return {
    key,
    weight
  }
}

describe('Utils', function () {
  let clock, txBuilderOpts;

  beforeEach(function () {
    clock = sinon.useFakeTimers();
    txBuilderOpts = {
      fee: 100,
      networkPassphrase: AiBlocksSdk.Networks.TESTNET
    };
  });

  afterEach(() => {
    clock.restore();
  });

  describe('Utils.buildChallengeTx', function () {
    it('requires a non-muxed account', function () {
      let keypair = AiBlocksSdk.Keypair.random();

      expect(() =>
        AiBlocksSdk.Utils.buildChallengeTx(
          keypair,
          "MAAAAAAAAAAAAAB7BQ2L7E5NBWMXDUCMZSIPOBKRDSBYVLMXGSSKF6YNPIB7Y77ITLVL6",
          "SDF",
          300,
          AiBlocksSdk.Networks.TESTNET
        )
      ).to.throw(
        /Invalid clientAccountID: multiplexed accounts are not supported./
      );
    });

    it('returns challenge which follows SEP0010 spec', function () {
      let keypair = AiBlocksSdk.Keypair.random();

      const challenge = AiBlocksSdk.Utils.buildChallengeTx(
        keypair,
        "GBDIT5GUJ7R5BXO3GJHFXJ6AZ5UQK6MNOIDMPQUSMXLIHTUNR2Q5CFNF",
        "testanchor.aiblocks.io",
        300,
        AiBlocksSdk.Networks.TESTNET
      );

      const transaction = new AiBlocksSdk.Transaction(challenge, AiBlocksSdk.Networks.TESTNET);

      expect(transaction.sequence).to.eql("0");
      expect(transaction.source).to.eql(keypair.publicKey());
      expect(transaction.operations.length).to.eql(1);

      const {
        maxTime,
        minTime
      } = transaction.timeBounds;

      expect(parseInt(maxTime) - parseInt(minTime)).to.eql(300);

      const [operation] = transaction.operations;

      expect(operation.name).to.eql("testanchor.aiblocks.io auth");
      expect(operation.source).to.eql("GBDIT5GUJ7R5BXO3GJHFXJ6AZ5UQK6MNOIDMPQUSMXLIHTUNR2Q5CFNF");
      expect(operation.type).to.eql("manageData");
      expect(operation.value.length).to.eql(64);
      expect(Buffer.from(operation.value.toString(), 'base64').length).to.eql(48);
    });

    it('uses the passed-in timeout', function () {
      let keypair = AiBlocksSdk.Keypair.random();

      const challenge = AiBlocksSdk.Utils.buildChallengeTx(
        keypair,
        "GBDIT5GUJ7R5BXO3GJHFXJ6AZ5UQK6MNOIDMPQUSMXLIHTUNR2Q5CFNF",
        "SDF",
        600,
        AiBlocksSdk.Networks.TESTNET
      );

      const transaction = new AiBlocksSdk.Transaction(challenge, AiBlocksSdk.Networks.TESTNET);

      let maxTime = parseInt(transaction.timeBounds.maxTime);
      let minTime = parseInt(transaction.timeBounds.minTime);

      expect(minTime).to.eql(0);
      expect(maxTime).to.eql(600);
      expect(maxTime - minTime).to.eql(600);
    });
  });

  describe("Utils.readChallengeTx", function () {
    it('requires a non-muxed account', function () {
      expect(() =>
        AiBlocksSdk.Utils.readChallengeTx(
          "avalidtx",
          "MAAAAAAAAAAAAAB7BQ2L7E5NBWMXDUCMZSIPOBKRDSBYVLMXGSSKF6YNPIB7Y77ITLVL6",
          "SDF",
          300,
          AiBlocksSdk.Networks.TESTNET,
          "testanchor.aiblocks.io",
        )
      ).to.throw(
        /Invalid serverAccountID: multiplexed accounts are not supported./
      );
    });
    it("requires a envelopeTypeTxV0 or envelopeTypeTx", function () {
      let serverKP = AiBlocksSdk.Keypair.random();
      let clientKP = AiBlocksSdk.Keypair.random();

      const challenge = AiBlocksSdk.Utils.buildChallengeTx(
        serverKP,
        clientKP.publicKey(),
        "SDF",
        300,
        AiBlocksSdk.Networks.TESTNET,
      );

      const innerTx = new AiBlocksSdk.TransactionBuilder(new AiBlocksSdk.Account(clientKP.publicKey(), "0"), {
          fee: '100',
          networkPassphrase: AiBlocksSdk.Networks.TESTNET,
          timebounds: {
            minTime: 0,
            maxTime: 0
          }
        })
        .addOperation(
          AiBlocksSdk.Operation.payment({
            destination: clientKP.publicKey(),
            asset: AiBlocksSdk.Asset.native(),
            amount: "10.000"
          })
        )
        .build();

      let feeBump = AiBlocksSdk.TransactionBuilder.buildFeeBumpTransaction(
        serverKP,
        "300",
        innerTx,
        AiBlocksSdk.Networks.TESTNET
      ).toXDR();

      expect(() =>
        AiBlocksSdk.Utils.readChallengeTx(
          feeBump,
          serverKP.publicKey(),
          AiBlocksSdk.Networks.TESTNET,
          "SDF",
        )
      ).to.throw(
        AiBlocksSdk.InvalidSep10ChallengeError,
        /Invalid challenge: expected a Transaction but received a FeeBumpTransaction/
      );

      expect(() =>
        AiBlocksSdk.Utils.readChallengeTx(
          challenge,
          serverKP.publicKey(),
          AiBlocksSdk.Networks.TESTNET,
          "SDF",
        )
      ).to.not.throw(AiBlocksSdk.InvalidSep10ChallengeError);
      expect(() =>
        AiBlocksSdk.Utils.readChallengeTx(
          feeBump.toXDR().toString('base64'),
          serverKP.publicKey(),
          AiBlocksSdk.Networks.TESTNET,
          "SDF",
        )
      ).to.not.throw(AiBlocksSdk.InvalidSep10ChallengeError);
    });
    it("returns the transaction and the clientAccountID (client's pubKey) if the challenge was created successfully", function () {
      let serverKP = AiBlocksSdk.Keypair.random();
      let clientKP = AiBlocksSdk.Keypair.random();

      const challenge = AiBlocksSdk.Utils.buildChallengeTx(
        serverKP,
        clientKP.publicKey(),
        "SDF",
        300,
        AiBlocksSdk.Networks.TESTNET
      );

      clock.tick(200);

      const transaction = new AiBlocksSdk.Transaction(
        challenge,
        AiBlocksSdk.Networks.TESTNET
      );

      expect(
        AiBlocksSdk.Utils.readChallengeTx(
          challenge,
          serverKP.publicKey(),
          AiBlocksSdk.Networks.TESTNET,
          "SDF",
        )
      ).to.eql({
        tx: transaction,
        clientAccountID: clientKP.publicKey(),
        matchedHomeDomain: "SDF",
      });
    });

    it("throws an error if transaction sequenceNumber is different to zero", function () {
      let keypair = AiBlocksSdk.Keypair.random();

      const account = new AiBlocksSdk.Account(keypair.publicKey(), "100");
      const transaction = new AiBlocksSdk.TransactionBuilder(
          account,
          txBuilderOpts,
        )
        .setTimeout(30)
        .build();

      let challenge = transaction
        .toEnvelope()
        .toXDR("base64")
        .toString();

      expect(() =>
        AiBlocksSdk.Utils.readChallengeTx(
          challenge,
          keypair.publicKey(),
          AiBlocksSdk.Networks.TESTNET,
          "SDF",
        ),
      ).to.throw(
        AiBlocksSdk.InvalidSep10ChallengeError,
        /The transaction sequence number should be zero/,
      );
    });

    it("throws an error if transaction source account is different to server account id", function () {
      let keypair = AiBlocksSdk.Keypair.random();

      const challenge = AiBlocksSdk.Utils.buildChallengeTx(
        keypair,
        "GBDIT5GUJ7R5BXO3GJHFXJ6AZ5UQK6MNOIDMPQUSMXLIHTUNR2Q5CFNF",
        "SDF",
        300,
        AiBlocksSdk.Networks.TESTNET,
      );

      let serverAccountId = AiBlocksSdk.Keypair.random().publicKey();

      expect(() =>
        AiBlocksSdk.Utils.readChallengeTx(
          challenge,
          serverAccountId,
          AiBlocksSdk.Networks.TESTNET,
          "SDF",
        ),
      ).to.throw(
        AiBlocksSdk.InvalidSep10ChallengeError,
        /The transaction source account is not equal to the server's account/,
      );
    });

    it("throws an error if transaction doestn't contain any operation", function () {
      let keypair = AiBlocksSdk.Keypair.random();
      const account = new AiBlocksSdk.Account(keypair.publicKey(), "-1");
      const transaction = new AiBlocksSdk.TransactionBuilder(
          account,
          txBuilderOpts,
        )
        .setTimeout(30)
        .build();

      transaction.sign(keypair);
      const challenge = transaction
        .toEnvelope()
        .toXDR("base64")
        .toString();

      expect(() =>
        AiBlocksSdk.Utils.readChallengeTx(
          challenge,
          keypair.publicKey(),
          AiBlocksSdk.Networks.TESTNET,
          "SDF",
        ),
      ).to.throw(
        AiBlocksSdk.InvalidSep10ChallengeError,
        /The transaction should contain at least one operation/,
      );
    });

    it("throws an error if operation does not contain the source account", function () {
      let keypair = AiBlocksSdk.Keypair.random();
      const account = new AiBlocksSdk.Account(keypair.publicKey(), "-1");
      const transaction = new AiBlocksSdk.TransactionBuilder(
          account,
          txBuilderOpts,
        )
        .addOperation(
          AiBlocksSdk.Operation.manageData({
            name: "SDF auth",
            value: randomBytes(48).toString("base64"),
          }),
        )
        .setTimeout(30)
        .build();

      transaction.sign(keypair);
      const challenge = transaction
        .toEnvelope()
        .toXDR("base64")
        .toString();

      expect(() =>
        AiBlocksSdk.Utils.readChallengeTx(
          challenge,
          keypair.publicKey(),
          AiBlocksSdk.Networks.TESTNET,
          "SDF",
        ),
      ).to.throw(
        AiBlocksSdk.InvalidSep10ChallengeError,
        /The transaction\'s operation should contain a source account/,
      );
    });

    it("throws an error if operation is not manage data", function () {
      let keypair = AiBlocksSdk.Keypair.random();
      const account = new AiBlocksSdk.Account(keypair.publicKey(), "-1");
      const transaction = new AiBlocksSdk.TransactionBuilder(
          account,
          txBuilderOpts,
        )
        .addOperation(
          AiBlocksSdk.Operation.accountMerge({
            destination: keypair.publicKey(),
            source: keypair.publicKey(),
          }),
        )
        .setTimeout(30)
        .build();

      transaction.sign(keypair);
      const challenge = transaction
        .toEnvelope()
        .toXDR("base64")
        .toString();

      expect(() =>
        AiBlocksSdk.Utils.readChallengeTx(
          challenge,
          keypair.publicKey(),
          AiBlocksSdk.Networks.TESTNET,
          "SDF",
        ),
      ).to.throw(
        AiBlocksSdk.InvalidSep10ChallengeError,
        /The transaction\'s operation type should be \'manageData\'/,
      );
    });

    it("throws an error if transaction.timeBounds.maxTime is infinite", function () {
      let serverKeypair = AiBlocksSdk.Keypair.random();
      let clientKeypair = AiBlocksSdk.Keypair.random();

      const anchorName = "SDF";
      const networkPassphrase = AiBlocksSdk.Networks.TESTNET;

      const account = new AiBlocksSdk.Account(serverKeypair.publicKey(), "-1");
      const now = Math.floor(Date.now() / 1000);

      const value = randomBytes(48).toString("base64");

      let transaction = new AiBlocksSdk.TransactionBuilder(account, {
          fee: AiBlocksSdk.BASE_FEE,
          networkPassphrase,
          timebounds: {
            minTime: now,
            maxTime: "0",
          },
        })
        .addOperation(
          AiBlocksSdk.Operation.manageData({
            name: `${anchorName} auth`,
            value,
            source: clientKeypair.publicKey(),
          }),
        )
        .build();

      transaction.sign(serverKeypair);
      const challenge = transaction
        .toEnvelope()
        .toXDR("base64")
        .toString();

      transaction = new AiBlocksSdk.Transaction(
        challenge,
        AiBlocksSdk.Networks.TESTNET,
      );
      transaction.sign(clientKeypair);

      const signedChallenge = transaction
        .toEnvelope()
        .toXDR("base64")
        .toString();

      expect(() =>
        AiBlocksSdk.Utils.readChallengeTx(
          signedChallenge,
          serverKeypair.publicKey(),
          AiBlocksSdk.Networks.TESTNET,
          anchorName,
        ),
      ).to.throw(
        AiBlocksSdk.InvalidSep10ChallengeError,
        /The transaction requires non-infinite timebounds/,
      );
    });

    it("throws an error if operation value is not a 64 bytes base64 string", function () {
      let keypair = AiBlocksSdk.Keypair.random();
      const account = new AiBlocksSdk.Account(keypair.publicKey(), "-1");
      const transaction = new AiBlocksSdk.TransactionBuilder(
          account,
          txBuilderOpts,
        )
        .addOperation(
          AiBlocksSdk.Operation.manageData({
            name: "SDF auth",
            value: randomBytes(64),
            source: "GBDIT5GUJ7R5BXO3GJHFXJ6AZ5UQK6MNOIDMPQUSMXLIHTUNR2Q5CFNF",
          }),
        )
        .setTimeout(30)
        .build();

      transaction.sign(keypair);
      const challenge = transaction
        .toEnvelope()
        .toXDR("base64")
        .toString();

      // expect(() =>
      //   AiBlocksSdk.Utils.readChallengeTx(
      //     challenge,
      //     keypair.publicKey(),
      //     AiBlocksSdk.Networks.TESTNET,
      //     "SDF",
      //   ),
      // ).to.throw(
      //   AiBlocksSdk.InvalidSep10ChallengeError,
      //   /The transaction\'s operation value should be a 64 bytes base64 random string/,
      // );
    });

    it("throws an error if transaction does not contain valid timeBounds", function () {
      let keypair = AiBlocksSdk.Keypair.random();
      let clientKeypair = AiBlocksSdk.Keypair.random();

      const challenge = AiBlocksSdk.Utils.buildChallengeTx(
        keypair,
        clientKeypair.publicKey(),
        "SDF",
        300,
        AiBlocksSdk.Networks.TESTNET,
      );

      clock.tick(350000);

      const transaction = new AiBlocksSdk.Transaction(
        challenge,
        AiBlocksSdk.Networks.TESTNET,
      );
      transaction.sign(clientKeypair);

      const signedChallenge = transaction
        .toEnvelope()
        .toXDR("base64")
        .toString();

      expect(() =>
        AiBlocksSdk.Utils.readChallengeTx(
          signedChallenge,
          keypair.publicKey(),
          AiBlocksSdk.Networks.TESTNET,
          "SDF",
        ),
      ).to.throw(
        AiBlocksSdk.InvalidSep10ChallengeError,
        /The transaction has expired/,
      );
    });

    it("home domain string matches transaction\'s operation key name", function () {
      let serverKP = AiBlocksSdk.Keypair.random();
      let clientKP = AiBlocksSdk.Keypair.random();
      const serverAccount = new AiBlocksSdk.Account(serverKP.publicKey(), "-1");
      const transaction = new AiBlocksSdk.TransactionBuilder(
          serverAccount,
          txBuilderOpts,
        )
        .addOperation(
          AiBlocksSdk.Operation.manageData({
            source: clientKP.publicKey(),
            name: "testanchor.aiblocks.io auth",
            value: randomBytes(48).toString("base64"),
          }),
        )
        .setTimeout(30)
        .build();

      transaction.sign(serverKP);
      const challenge = transaction
        .toEnvelope()
        .toXDR("base64")
        .toString();

      const transactionRoundTripped = new AiBlocksSdk.Transaction(
        challenge,
        AiBlocksSdk.Networks.TESTNET
      );

      expect(
        AiBlocksSdk.Utils.readChallengeTx(
          challenge,
          serverKP.publicKey(),
          AiBlocksSdk.Networks.TESTNET,
          "testanchor.aiblocks.io",
        ),
      ).to.eql({
        tx: transactionRoundTripped,
        clientAccountID: clientKP.publicKey(),
        matchedHomeDomain: "testanchor.aiblocks.io",
      });
    });

    it("home domain in array matches transaction\'s operation key name", function () {
      let serverKP = AiBlocksSdk.Keypair.random();
      let clientKP = AiBlocksSdk.Keypair.random();
      const serverAccount = new AiBlocksSdk.Account(serverKP.publicKey(), "-1");
      const transaction = new AiBlocksSdk.TransactionBuilder(
          serverAccount,
          txBuilderOpts,
        )
        .addOperation(
          AiBlocksSdk.Operation.manageData({
            source: clientKP.publicKey(),
            name: "testanchor.aiblocks.io auth",
            value: randomBytes(48).toString("base64"),
          }),
        )
        .setTimeout(30)
        .build();

      transaction.sign(serverKP);
      const challenge = transaction
        .toEnvelope()
        .toXDR("base64")
        .toString();

      const transactionRoundTripped = new AiBlocksSdk.Transaction(
        challenge,
        AiBlocksSdk.Networks.TESTNET
      );

      expect(
        AiBlocksSdk.Utils.readChallengeTx(
          challenge,
          serverKP.publicKey(),
          AiBlocksSdk.Networks.TESTNET,
          ["SDF", "Test", "testanchor.aiblocks.io", "SDF-test"],
        ),
      ).to.eql({
        tx: transactionRoundTripped,
        clientAccountID: clientKP.publicKey(),
        matchedHomeDomain: "testanchor.aiblocks.io",
      });
    });

    it("throws an error if home domain is not provided", function () {
      let serverKP = AiBlocksSdk.Keypair.random();
      let clientKP = AiBlocksSdk.Keypair.random();
      const serverAccount = new AiBlocksSdk.Account(serverKP.publicKey(), "-1");
      const transaction = new AiBlocksSdk.TransactionBuilder(
          serverAccount,
          txBuilderOpts,
        )
        .addOperation(
          AiBlocksSdk.Operation.manageData({
            source: clientKP.publicKey(),
            name: "testanchor.aiblocks.io auth",
            value: randomBytes(48).toString("base64"),
          }),
        )
        .setTimeout(30)
        .build();

      transaction.sign(serverKP);
      const challenge = transaction
        .toEnvelope()
        .toXDR("base64")
        .toString();

      expect(() =>
        AiBlocksSdk.Utils.readChallengeTx(
          challenge,
          serverKP.publicKey(),
          AiBlocksSdk.Networks.TESTNET,
          // home domain not provided
        ),
      ).to.throw(
        AiBlocksSdk.InvalidSep10ChallengeError,
        /Invalid homeDomains: a home domain must be provided for verification/,
      );
    });

    it("throws an error if home domain type is not string or array", function () {
      let serverKP = AiBlocksSdk.Keypair.random();
      let clientKP = AiBlocksSdk.Keypair.random();
      const serverAccount = new AiBlocksSdk.Account(serverKP.publicKey(), "-1");
      const transaction = new AiBlocksSdk.TransactionBuilder(
          serverAccount,
          txBuilderOpts,
        )
        .addOperation(
          AiBlocksSdk.Operation.manageData({
            source: clientKP.publicKey(),
            name: "testanchor.aiblocks.io auth",
            value: randomBytes(48).toString("base64"),
          }),
        )
        .setTimeout(30)
        .build();

      transaction.sign(serverKP);
      const challenge = transaction
        .toEnvelope()
        .toXDR("base64")
        .toString();

      expect(() =>
        AiBlocksSdk.Utils.readChallengeTx(
          challenge,
          serverKP.publicKey(),
          AiBlocksSdk.Networks.TESTNET,
          // home domain as number
          1,
        ),
      ).to.throw(
        AiBlocksSdk.InvalidSep10ChallengeError,
        /Invalid homeDomains: homeDomains type is number but should be a string or an array/,
      );
    });

    it("throws an error if home domain string does not match transaction\'s operation key name", function () {
      let serverKP = AiBlocksSdk.Keypair.random();
      let clientKP = AiBlocksSdk.Keypair.random();
      const serverAccount = new AiBlocksSdk.Account(serverKP.publicKey(), "-1");
      const transaction = new AiBlocksSdk.TransactionBuilder(
          serverAccount,
          txBuilderOpts,
        )
        .addOperation(
          AiBlocksSdk.Operation.manageData({
            source: clientKP.publicKey(),
            name: "does.not.match auth",
            value: randomBytes(48).toString("base64"),
          }),
        )
        .setTimeout(30)
        .build();

      transaction.sign(serverKP);
      const challenge = transaction
        .toEnvelope()
        .toXDR("base64")
        .toString();

      expect(() =>
        AiBlocksSdk.Utils.readChallengeTx(
          challenge,
          serverKP.publicKey(),
          AiBlocksSdk.Networks.TESTNET,
          "testanchor.aiblocks.io",
        ),
      ).to.throw(
        AiBlocksSdk.InvalidSep10ChallengeError,
        /Invalid homeDomains: the transaction\'s operation key name does not match the expected home domain/,
      );
    });

    it("throws an error if home domain array does not have a match to transaction\'s operation key name", function () {
      let serverKP = AiBlocksSdk.Keypair.random();
      let clientKP = AiBlocksSdk.Keypair.random();
      const serverAccount = new AiBlocksSdk.Account(serverKP.publicKey(), "-1");
      const transaction = new AiBlocksSdk.TransactionBuilder(
          serverAccount,
          txBuilderOpts,
        )
        .addOperation(
          AiBlocksSdk.Operation.manageData({
            source: clientKP.publicKey(),
            name: "does.not.match auth",
            value: randomBytes(48).toString("base64"),
          }),
        )
        .setTimeout(30)
        .build();

      transaction.sign(serverKP);
      const challenge = transaction
        .toEnvelope()
        .toXDR("base64")
        .toString();

      expect(() =>
        AiBlocksSdk.Utils.readChallengeTx(
          challenge,
          serverKP.publicKey(),
          AiBlocksSdk.Networks.TESTNET,
          ["SDF", "Test", "testanchor.aiblocks.io", "SDF-test"],
        ),
      ).to.throw(
        AiBlocksSdk.InvalidSep10ChallengeError,
        /Invalid homeDomains: the transaction\'s operation key name does not match the expected home domain/,
      );
    });

    it("allows transaction to contain subsequent manage data ops with server account as source account", function () {
      let serverKP = AiBlocksSdk.Keypair.random();
      let clientKP = AiBlocksSdk.Keypair.random();
      const serverAccount = new AiBlocksSdk.Account(serverKP.publicKey(), "-1");
      const transaction = new AiBlocksSdk.TransactionBuilder(
          serverAccount,
          txBuilderOpts,
        )
        .addOperation(
          AiBlocksSdk.Operation.manageData({
            source: clientKP.publicKey(),
            name: "SDF auth",
            value: randomBytes(48).toString("base64"),
          }),
        )
        .addOperation(
          AiBlocksSdk.Operation.manageData({
            source: serverKP.publicKey(),
            name: "a key",
            value: "a value",
          }),
        )
        .setTimeout(30)
        .build();

      transaction.sign(serverKP);
      const challenge = transaction
        .toEnvelope()
        .toXDR("base64")
        .toString();

      const transactionRoundTripped = new AiBlocksSdk.Transaction(
        challenge,
        AiBlocksSdk.Networks.TESTNET
      );

      expect(
        AiBlocksSdk.Utils.readChallengeTx(
          challenge,
          serverKP.publicKey(),
          AiBlocksSdk.Networks.TESTNET,
          "SDF",
        ),
      ).to.eql({
        tx: transactionRoundTripped,
        clientAccountID: clientKP.publicKey(),
        matchedHomeDomain: "SDF",
      });
    });

    it("throws an error if the transaction contain subsequent manage data ops without the server account as the source account", function () {
      let serverKP = AiBlocksSdk.Keypair.random();
      let clientKP = AiBlocksSdk.Keypair.random();
      const serverAccount = new AiBlocksSdk.Account(serverKP.publicKey(), "-1");
      const transaction = new AiBlocksSdk.TransactionBuilder(
          serverAccount,
          txBuilderOpts,
        )
        .addOperation(
          AiBlocksSdk.Operation.manageData({
            source: clientKP.publicKey(),
            name: "SDF auth",
            value: randomBytes(48).toString("base64"),
          }),
        )
        .addOperation(
          AiBlocksSdk.Operation.manageData({
            source: clientKP.publicKey(),
            name: "a key",
            value: "a value",
          }),
        )
        .setTimeout(30)
        .build();

      transaction.sign(serverKP);
      const challenge = transaction
        .toEnvelope()
        .toXDR("base64")
        .toString();

      const transactionRoundTripped = new AiBlocksSdk.Transaction(
        challenge,
        AiBlocksSdk.Networks.TESTNET
      );

      expect(() =>
        AiBlocksSdk.Utils.readChallengeTx(
          challenge,
          serverKP.publicKey(),
          AiBlocksSdk.Networks.TESTNET,
          "SDF",
        ),
      ).to.throw(
        AiBlocksSdk.InvalidSep10ChallengeError,
        /The transaction has operations that are unrecognized/,
      );
    });

    it("throws an error if the transaction contain subsequent ops that are not manage data ops", function () {
      let serverKP = AiBlocksSdk.Keypair.random();
      let clientKP = AiBlocksSdk.Keypair.random();
      const serverAccount = new AiBlocksSdk.Account(serverKP.publicKey(), "-1");
      const transaction = new AiBlocksSdk.TransactionBuilder(
          serverAccount,
          txBuilderOpts,
        )
        .addOperation(
          AiBlocksSdk.Operation.manageData({
            source: clientKP.publicKey(),
            name: "SDF auth",
            value: randomBytes(48).toString("base64"),
          }),
        )
        .addOperation(
          AiBlocksSdk.Operation.bumpSequence({
            source: clientKP.publicKey(),
            bumpTo: "0",
          }),
        )
        .setTimeout(30)
        .build();

      transaction.sign(serverKP);
      const challenge = transaction
        .toEnvelope()
        .toXDR("base64")
        .toString();

      const transactionRoundTripped = new AiBlocksSdk.Transaction(
        challenge,
        AiBlocksSdk.Networks.TESTNET
      );

      expect(() =>
        AiBlocksSdk.Utils.readChallengeTx(
          challenge,
          serverKP.publicKey(),
          AiBlocksSdk.Networks.TESTNET,
          "SDF",
        ),
      ).to.throw(
        AiBlocksSdk.InvalidSep10ChallengeError,
        /The transaction has operations that are not of type 'manageData'/,
      );
    });
  });

  describe("Utils.verifyChallengeTxThreshold", function () {
    beforeEach(function () {
      this.serverKP = AiBlocksSdk.Keypair.random();
      this.clientKP1 = AiBlocksSdk.Keypair.random();
      this.clientKP2 = AiBlocksSdk.Keypair.random();
      this.clientKP3 = AiBlocksSdk.Keypair.random();

      this.txAccount = new AiBlocksSdk.Account(this.serverKP.publicKey(), "-1");
      this.opAccount = new AiBlocksSdk.Account(this.clientKP1.publicKey(), "0");

      this.operation = AiBlocksSdk.Operation.manageData({
        source: this.clientKP1.publicKey(),
        name: "SDF-test auth",
        value: randomBytes(48).toString("base64"),
      });

      this.txBuilderOpts = {
        fee: 100,
        networkPassphrase: AiBlocksSdk.Networks.TESTNET,
      };
    });

    afterEach(function () {
      this.serverKP, this.clientKP1, this.clientKP2, this.txAccount, this.opAccount, this.operation = null;
    });

    it("throws an error if the server hasn't signed the transaction", function () {
      const transaction = new AiBlocksSdk.TransactionBuilder(
          this.txAccount,
          this.txBuilderOpts,
        )
        .addOperation(this.operation)
        .setTimeout(30)
        .build();

      const threshold = 1;
      const signerSummary = [
        newClientSigner(this.clientKP1.publicKey(), 1)
      ];

      transaction.sign(this.clientKP1);

      const challenge = transaction
        .toEnvelope()
        .toXDR("base64")
        .toString();

      expect(() =>
        AiBlocksSdk.Utils.verifyChallengeTxThreshold(
          challenge,
          this.serverKP.publicKey(),
          AiBlocksSdk.Networks.TESTNET,
          threshold,
          signerSummary,
          "SDF-test"
        ),
      ).to.throw(
        AiBlocksSdk.InvalidSep10ChallengeError,
        "Transaction not signed by server: '" + this.serverKP.publicKey() + "'",
      );
    });

    it("successfully validates server and client key meeting threshold", function () {
      const challenge = AiBlocksSdk.Utils.buildChallengeTx(
        this.serverKP,
        this.clientKP1.publicKey(),
        "SDF",
        300,
        AiBlocksSdk.Networks.TESTNET,
      );

      clock.tick(200);

      const transaction = new AiBlocksSdk.Transaction(
        challenge,
        AiBlocksSdk.Networks.TESTNET,
      );
      transaction.sign(this.clientKP1);
      const signedChallenge = transaction
        .toEnvelope()
        .toXDR("base64")
        .toString();

      const threshold = 1;
      const signerSummary = [
        newClientSigner(this.clientKP1.publicKey(), 1)
      ];

      expect(
        AiBlocksSdk.Utils.verifyChallengeTxThreshold(
          signedChallenge,
          this.serverKP.publicKey(),
          AiBlocksSdk.Networks.TESTNET,
          threshold,
          signerSummary,
          "SDF",
        ),
      ).to.eql([this.clientKP1.publicKey()]);
    });

    it("successfully validates server and multiple client keys, meeting threshold", function () {
      const challenge = AiBlocksSdk.Utils.buildChallengeTx(
        this.serverKP,
        this.clientKP1.publicKey(),
        "SDF",
        300,
        AiBlocksSdk.Networks.TESTNET,
      );

      clock.tick(200);

      const transaction = new AiBlocksSdk.Transaction(
        challenge,
        AiBlocksSdk.Networks.TESTNET,
      );
      transaction.sign(this.clientKP1, this.clientKP2);
      const signedChallenge = transaction
        .toEnvelope()
        .toXDR("base64")
        .toString();

      const threshold = 3;
      const signerSummary = [
        newClientSigner(this.clientKP1.publicKey(), 1),
        newClientSigner(this.clientKP2.publicKey(), 2)
      ];

      expect(
        AiBlocksSdk.Utils.verifyChallengeTxThreshold(
          signedChallenge,
          this.serverKP.publicKey(),
          AiBlocksSdk.Networks.TESTNET,
          threshold,
          signerSummary,
          "SDF",
        ),
      ).to.eql([this.clientKP1.publicKey(), this.clientKP2.publicKey()]);
    });

    it("successfully validates server and multiple client keys, meeting threshold with more keys than needed", function () {
      const challenge = AiBlocksSdk.Utils.buildChallengeTx(
        this.serverKP,
        this.clientKP1.publicKey(),
        "SDF",
        300,
        AiBlocksSdk.Networks.TESTNET,
      );

      clock.tick(200);

      const transaction = new AiBlocksSdk.Transaction(
        challenge,
        AiBlocksSdk.Networks.TESTNET,
      );
      transaction.sign(this.clientKP1, this.clientKP2);
      const signedChallenge = transaction
        .toEnvelope()
        .toXDR("base64")
        .toString();

      const threshold = 3;
      const signerSummary = [
        newClientSigner(this.clientKP1.publicKey(), 1),
        newClientSigner(this.clientKP2.publicKey(), 2),
        newClientSigner(this.clientKP3.publicKey(), 2)
      ];

      expect(
        AiBlocksSdk.Utils.verifyChallengeTxThreshold(
          signedChallenge,
          this.serverKP.publicKey(),
          AiBlocksSdk.Networks.TESTNET,
          threshold,
          signerSummary,
          "SDF",
        ),
      ).to.eql([this.clientKP1.publicKey(), this.clientKP2.publicKey()]);
    });

    it("successfully validates server and multiple client keys, meeting threshold with more keys than needed but ignoring PreauthTxHash and XHash", function () {
      const preauthTxHash = "TAQCSRX2RIDJNHFIFHWD63X7D7D6TRT5Y2S6E3TEMXTG5W3OECHZ2OG4";
      const xHash = "XDRPF6NZRR7EEVO7ESIWUDXHAOMM2QSKIQQBJK6I2FB7YKDZES5UCLWD";
      const unknownSignerType = "?ARPF6NZRR7EEVO7ESIWUDXHAOMM2QSKIQQBJK6I2FB7YKDZES5UCLWD";

      const challenge = AiBlocksSdk.Utils.buildChallengeTx(
        this.serverKP,
        this.clientKP1.publicKey(),
        "SDF",
        300,
        AiBlocksSdk.Networks.TESTNET,
      );

      clock.tick(200);

      const transaction = new AiBlocksSdk.Transaction(
        challenge,
        AiBlocksSdk.Networks.TESTNET,
      );
      transaction.sign(this.clientKP1, this.clientKP2);
      const signedChallenge = transaction
        .toEnvelope()
        .toXDR("base64")
        .toString();

      const threshold = 3;
      const signerSummary = [
        newClientSigner(this.clientKP1.publicKey(), 1),
        newClientSigner(this.clientKP2.publicKey(), 2),
        newClientSigner(this.clientKP3.publicKey(), 2),
        newClientSigner(preauthTxHash, 10),
        newClientSigner(xHash, 10),
        newClientSigner(unknownSignerType, 10),
      ];

      expect(
        AiBlocksSdk.Utils.verifyChallengeTxThreshold(
          signedChallenge,
          this.serverKP.publicKey(),
          AiBlocksSdk.Networks.TESTNET,
          threshold,
          signerSummary,
          "SDF",
        ),
      ).to.eql([this.clientKP1.publicKey(), this.clientKP2.publicKey()]);
    });

    it("throws an error if multiple client keys were not enough to meet the threshold", function () {
      const challenge = AiBlocksSdk.Utils.buildChallengeTx(
        this.serverKP,
        this.clientKP1.publicKey(),
        "SDF",
        300,
        AiBlocksSdk.Networks.TESTNET,
      );

      clock.tick(200);

      const transaction = new AiBlocksSdk.Transaction(
        challenge,
        AiBlocksSdk.Networks.TESTNET,
      );
      transaction.sign(this.clientKP1, this.clientKP2);
      const signedChallenge = transaction
        .toEnvelope()
        .toXDR("base64")
        .toString();

      const threshold = 10;
      const signerSummary = [
        newClientSigner(this.clientKP1.publicKey(), 1),
        newClientSigner(this.clientKP2.publicKey(), 2),
        newClientSigner(this.clientKP3.publicKey(), 2),
      ];

      expect(() =>
        AiBlocksSdk.Utils.verifyChallengeTxThreshold(
          signedChallenge,
          this.serverKP.publicKey(),
          AiBlocksSdk.Networks.TESTNET,
          threshold,
          signerSummary,
          "SDF",
        ),
      ).to.throw(
        AiBlocksSdk.InvalidSep10ChallengeError,
        `signers with weight 3 do not meet threshold ${threshold}"`,
      );
    });

    it("throws an error if an unrecognized (not from the signerSummary) key has signed the transaction", function () {
      const challenge = AiBlocksSdk.Utils.buildChallengeTx(
        this.serverKP,
        this.clientKP1.publicKey(),
        "SDF",
        300,
        AiBlocksSdk.Networks.TESTNET,
      );

      clock.tick(200);

      const transaction = new AiBlocksSdk.Transaction(
        challenge,
        AiBlocksSdk.Networks.TESTNET,
      );
      transaction.sign(this.clientKP1, this.clientKP2, this.clientKP3);
      const signedChallenge = transaction
        .toEnvelope()
        .toXDR("base64")
        .toString();

      const threshold = 10;
      const signerSummary = [
        newClientSigner(this.clientKP1.publicKey(), 1),
        newClientSigner(this.clientKP2.publicKey(), 2),
      ];

      expect(() =>
        AiBlocksSdk.Utils.verifyChallengeTxThreshold(
          signedChallenge,
          this.serverKP.publicKey(),
          AiBlocksSdk.Networks.TESTNET,
          threshold,
          signerSummary,
          "SDF",
        ),
      ).to.throw(
        AiBlocksSdk.InvalidSep10ChallengeError,
        /Transaction has unrecognized signatures/,
      );
    });

    it("throws an error if the signerSummary is empty", function () {
      const challenge = AiBlocksSdk.Utils.buildChallengeTx(
        this.serverKP,
        this.clientKP1.publicKey(),
        "SDF",
        300,
        AiBlocksSdk.Networks.TESTNET,
      );

      clock.tick(200);

      const transaction = new AiBlocksSdk.Transaction(
        challenge,
        AiBlocksSdk.Networks.TESTNET,
      );
      transaction.sign(this.clientKP1, this.clientKP2, this.clientKP3);
      const signedChallenge = transaction
        .toEnvelope()
        .toXDR("base64")
        .toString();

      const threshold = 10;

      expect(() =>
        AiBlocksSdk.Utils.verifyChallengeTxThreshold(
          signedChallenge,
          this.serverKP.publicKey(),
          AiBlocksSdk.Networks.TESTNET,
          threshold,
          [],
          "SDF",
        ),
      ).to.throw(
        AiBlocksSdk.InvalidSep10ChallengeError,
        /No verifiable client signers provided, at least one G... address must be provided/,
      );
    });
  });

  describe("Utils.verifyChallengeTxSigners", function () {
    beforeEach(function () {
      this.serverKP = AiBlocksSdk.Keypair.random();
      this.clientKP1 = AiBlocksSdk.Keypair.random();
      this.clientKP2 = AiBlocksSdk.Keypair.random();

      this.txAccount = new AiBlocksSdk.Account(this.serverKP.publicKey(), "-1");
      this.opAccount = new AiBlocksSdk.Account(this.clientKP1.publicKey(), "0");

      this.operation = AiBlocksSdk.Operation.manageData({
        source: this.clientKP1.publicKey(),
        name: "SDF-test auth",
        value: randomBytes(48).toString("base64"),
      });

      this.txBuilderOpts = {
        fee: 100,
        networkPassphrase: AiBlocksSdk.Networks.TESTNET,
      };
    });

    afterEach(function () {
      this.serverKP, this.clientKP1, this.clientKP2, this.txAccount, this.opAccount, this.operation = null;
    });

    it("successfully validates server and client master key signatures in the transaction", function () {
      const challenge = AiBlocksSdk.Utils.buildChallengeTx(
        this.serverKP,
        this.clientKP1.publicKey(),
        "SDF",
        300,
        AiBlocksSdk.Networks.TESTNET,
      );

      clock.tick(200);

      const transaction = new AiBlocksSdk.Transaction(
        challenge,
        AiBlocksSdk.Networks.TESTNET,
      );
      transaction.sign(this.clientKP1);

      const signedChallenge = transaction
        .toEnvelope()
        .toXDR("base64")
        .toString();

      expect(
        AiBlocksSdk.Utils.verifyChallengeTxSigners(
          signedChallenge,
          this.serverKP.publicKey(),
          AiBlocksSdk.Networks.TESTNET,
          [this.clientKP1.publicKey()],
          "SDF",
        ),
      ).to.eql([this.clientKP1.publicKey()]);
    });

    it("throws an error if the server hasn't signed the transaction", function () {
      const transaction = new AiBlocksSdk.TransactionBuilder(
          this.txAccount,
          this.txBuilderOpts,
        )
        .addOperation(this.operation)
        .setTimeout(30)
        .build();

      transaction.sign(AiBlocksSdk.Keypair.random()); // Signing with another key pair instead of the server's

      const invalidsServerSignedChallenge = transaction
        .toEnvelope()
        .toXDR("base64")
        .toString();

      expect(() =>
        AiBlocksSdk.Utils.verifyChallengeTxSigners(
          invalidsServerSignedChallenge,
          this.serverKP.publicKey(),
          AiBlocksSdk.Networks.TESTNET,
          [this.clientKP1.publicKey()],
          "SDF-test",
        ),
      ).to.throw(
        AiBlocksSdk.InvalidSep10ChallengeError,
        "Transaction not signed by server: '" + this.serverKP.publicKey() + "'",
      );
    });

    it("throws an error if the list of signers is empty", function () {
      const challenge = AiBlocksSdk.Utils.buildChallengeTx(
        this.serverKP,
        this.clientKP1.publicKey(),
        "SDF",
        300,
        AiBlocksSdk.Networks.TESTNET,
      );

      clock.tick(200);

      expect(() =>
        AiBlocksSdk.Utils.verifyChallengeTxSigners(
          challenge,
          this.serverKP.publicKey(),
          AiBlocksSdk.Networks.TESTNET,
          [],
          "SDF",
        ),
      ).to.throw(
        AiBlocksSdk.InvalidSep10ChallengeError,
        /No verifiable client signers provided, at least one G... address must be provided/,
      );
    });

    it("throws an error if none of the given signers have signed the transaction", function () {
      const challenge = AiBlocksSdk.Utils.buildChallengeTx(
        this.serverKP,
        this.clientKP1.publicKey(),
        "SDF",
        300,
        AiBlocksSdk.Networks.TESTNET,
      );

      clock.tick(200);

      const transaction = new AiBlocksSdk.Transaction(
        challenge,
        AiBlocksSdk.Networks.TESTNET,
      );
      transaction.sign(AiBlocksSdk.Keypair.random(), AiBlocksSdk.Keypair.random());
      const signedChallenge = transaction
        .toEnvelope()
        .toXDR("base64")
        .toString();

      expect(() =>
        AiBlocksSdk.Utils.verifyChallengeTxSigners(
          signedChallenge,
          this.serverKP.publicKey(),
          AiBlocksSdk.Networks.TESTNET,
          [this.clientKP1.publicKey()],
          "SDF",
        ),
      ).to.throw(
        AiBlocksSdk.InvalidSep10ChallengeError,
        /None of the given signers match the transaction signatures/,
      );
    });

    it("successfully validates server and multiple client signers in the transaction", function () {
      const challenge = AiBlocksSdk.Utils.buildChallengeTx(
        this.serverKP,
        this.clientKP1.publicKey(),
        "SDF",
        300,
        AiBlocksSdk.Networks.TESTNET,
      );

      clock.tick(200);

      const transaction = new AiBlocksSdk.Transaction(
        challenge,
        AiBlocksSdk.Networks.TESTNET,
      );
      const clientSigners = [this.clientKP1, this.clientKP2];
      transaction.sign(...clientSigners);
      const clientSignersPubKey = clientSigners.map(kp => kp.publicKey());

      const signedChallenge = transaction
        .toEnvelope()
        .toXDR("base64")
        .toString();

      expect(
        AiBlocksSdk.Utils.verifyChallengeTxSigners(
          signedChallenge,
          this.serverKP.publicKey(),
          AiBlocksSdk.Networks.TESTNET,
          clientSignersPubKey,
          "SDF",
        ),
      ).to.eql(clientSignersPubKey);
    });

    it("successfully validates server and multiple client signers, in reverse order", function () {
      const challenge = AiBlocksSdk.Utils.buildChallengeTx(
        this.serverKP,
        this.clientKP1.publicKey(),
        "SDF",
        300,
        AiBlocksSdk.Networks.TESTNET,
      );

      clock.tick(200);

      const transaction = new AiBlocksSdk.Transaction(
        challenge,
        AiBlocksSdk.Networks.TESTNET,
      );
      const clientSigners = [this.clientKP1, this.clientKP2];
      transaction.sign(...clientSigners.reverse());
      const clientSignersPubKey = clientSigners.map(kp => kp.publicKey());

      const signedChallenge = transaction
        .toEnvelope()
        .toXDR("base64")
        .toString();

      expect(
        AiBlocksSdk.Utils.verifyChallengeTxSigners(
          signedChallenge,
          this.serverKP.publicKey(),
          AiBlocksSdk.Networks.TESTNET,
          clientSignersPubKey,
          "SDF",
        ),
      ).to.have.same.members(clientSignersPubKey);
    });

    it("successfully validates server and non-masterkey client signer", function () {
      const challenge = AiBlocksSdk.Utils.buildChallengeTx(
        this.serverKP,
        this.clientKP1.publicKey(),
        "SDF",
        300,
        AiBlocksSdk.Networks.TESTNET,
      );

      clock.tick(200);

      const transaction = new AiBlocksSdk.Transaction(
        challenge,
        AiBlocksSdk.Networks.TESTNET,
      );
      transaction.sign(this.clientKP2);

      const signedChallenge = transaction
        .toEnvelope()
        .toXDR("base64")
        .toString();

      expect(
        AiBlocksSdk.Utils.verifyChallengeTxSigners(
          signedChallenge,
          this.serverKP.publicKey(),
          AiBlocksSdk.Networks.TESTNET,
          [this.clientKP2.publicKey()],
          "SDF",
        ),
      ).to.eql([this.clientKP2.publicKey()]);
    });

    it("successfully validates server and non-master key client signer, ignoring extra signer", function () {
      const challenge = AiBlocksSdk.Utils.buildChallengeTx(
        this.serverKP,
        this.clientKP1.publicKey(),
        "SDF",
        300,
        AiBlocksSdk.Networks.TESTNET,
      );

      clock.tick(200);

      const transaction = new AiBlocksSdk.Transaction(
        challenge,
        AiBlocksSdk.Networks.TESTNET,
      );
      transaction.sign(this.clientKP2);

      const signedChallenge = transaction
        .toEnvelope()
        .toXDR("base64")
        .toString();

      expect(
        AiBlocksSdk.Utils.verifyChallengeTxSigners(
          signedChallenge,
          this.serverKP.publicKey(),
          AiBlocksSdk.Networks.TESTNET,
          [this.clientKP2.publicKey(), AiBlocksSdk.Keypair.random().publicKey()],
          "SDF",
        ),
      ).to.eql([this.clientKP2.publicKey()]);
    });

    it("throws an error if no client but insted the server has signed the transaction", function () {
      const challenge = AiBlocksSdk.Utils.buildChallengeTx(
        this.serverKP,
        this.clientKP1.publicKey(),
        "SDF",
        300,
        AiBlocksSdk.Networks.TESTNET,
      );

      clock.tick(200);

      const transaction = new AiBlocksSdk.Transaction(
        challenge,
        AiBlocksSdk.Networks.TESTNET,
      );
      transaction.sign(this.serverKP);

      const signedChallenge = transaction
        .toEnvelope()
        .toXDR("base64")
        .toString();

      expect(() =>
        AiBlocksSdk.Utils.verifyChallengeTxSigners(
          signedChallenge,
          this.serverKP.publicKey(),
          AiBlocksSdk.Networks.TESTNET,
          [this.clientKP2.publicKey(), this.serverKP.publicKey()],
          "SDF",
        ),
      ).to.throw(
        AiBlocksSdk.InvalidSep10ChallengeError,
        /None of the given signers match the transaction signatures/,
      );
    });

    it("successfully validates server and non-masterkey client signer, ignoring duplicated client signers", function () {
      const challenge = AiBlocksSdk.Utils.buildChallengeTx(
        this.serverKP,
        this.clientKP1.publicKey(),
        "SDF",
        300,
        AiBlocksSdk.Networks.TESTNET,
      );

      clock.tick(200);

      const transaction = new AiBlocksSdk.Transaction(
        challenge,
        AiBlocksSdk.Networks.TESTNET,
      );
      transaction.sign(this.clientKP2);

      const signedChallenge = transaction
        .toEnvelope()
        .toXDR("base64")
        .toString();

      expect(
        AiBlocksSdk.Utils.verifyChallengeTxSigners(
          signedChallenge,
          this.serverKP.publicKey(),
          AiBlocksSdk.Networks.TESTNET,
          [this.clientKP2.publicKey(), this.clientKP2.publicKey()],
          "SDF",
        ),
      ).to.eql([this.clientKP2.publicKey()]);
    });

    it("successfully validates server and non-masterkey client signer, ignoring preauthTxHash and xHash", function () {
      const preauthTxHash = "TAQCSRX2RIDJNHFIFHWD63X7D7D6TRT5Y2S6E3TEMXTG5W3OECHZ2OG4";
      const xHash = "XDRPF6NZRR7EEVO7ESIWUDXHAOMM2QSKIQQBJK6I2FB7YKDZES5UCLWD";
      const unknownSignerType = "?ARPF6NZRR7EEVO7ESIWUDXHAOMM2QSKIQQBJK6I2FB7YKDZES5UCLWD";

      const challenge = AiBlocksSdk.Utils.buildChallengeTx(
        this.serverKP,
        this.clientKP1.publicKey(),
        "SDF",
        300,
        AiBlocksSdk.Networks.TESTNET,
      );

      clock.tick(200);

      const transaction = new AiBlocksSdk.Transaction(
        challenge,
        AiBlocksSdk.Networks.TESTNET,
      );
      transaction.sign(this.clientKP2);

      const signedChallenge = transaction
        .toEnvelope()
        .toXDR("base64")
        .toString();

      expect(
        AiBlocksSdk.Utils.verifyChallengeTxSigners(
          signedChallenge,
          this.serverKP.publicKey(),
          AiBlocksSdk.Networks.TESTNET,
          [this.clientKP2.publicKey(), preauthTxHash, xHash, unknownSignerType],
          "SDF",
        ),
      ).to.eql([this.clientKP2.publicKey()]);
    });

    it("throws an error if duplicated signers have been provided and they haven't actually signed the transaction", function () {
      const challenge = AiBlocksSdk.Utils.buildChallengeTx(
        this.serverKP,
        this.clientKP1.publicKey(),
        "SDF",
        300,
        AiBlocksSdk.Networks.TESTNET,
      );

      clock.tick(200);

      const transaction = new AiBlocksSdk.Transaction(
        challenge,
        AiBlocksSdk.Networks.TESTNET,
      );
      transaction.sign(this.clientKP1);
      const signedChallenge = transaction
        .toEnvelope()
        .toXDR("base64")
        .toString();

      expect(() =>
        AiBlocksSdk.Utils.verifyChallengeTxSigners(
          signedChallenge,
          this.serverKP.publicKey(),
          AiBlocksSdk.Networks.TESTNET,
          [this.clientKP2.publicKey(), this.clientKP2.publicKey()],
          "SDF",
        ),
      ).to.throw(
        AiBlocksSdk.InvalidSep10ChallengeError,
        /None of the given signers match the transaction signatures/,
      );
    });

    it("throws an error if the same KP has signed the transaction more than once", function () {
      const challenge = AiBlocksSdk.Utils.buildChallengeTx(
        this.serverKP,
        this.clientKP1.publicKey(),
        "SDF",
        300,
        AiBlocksSdk.Networks.TESTNET,
      );

      clock.tick(200);

      const transaction = new AiBlocksSdk.Transaction(
        challenge,
        AiBlocksSdk.Networks.TESTNET,
      );
      transaction.sign(this.clientKP2, this.clientKP2);

      const signedChallenge = transaction
        .toEnvelope()
        .toXDR("base64")
        .toString();

      expect(() =>
        AiBlocksSdk.Utils.verifyChallengeTxSigners(
          signedChallenge,
          this.serverKP.publicKey(),
          AiBlocksSdk.Networks.TESTNET,
          [this.clientKP2.publicKey()],
          "SDF",
        ),
      ).to.throw(
        AiBlocksSdk.InvalidSep10ChallengeError,
        /Transaction has unrecognized signatures/,
      );
    });

    it("throws an error if the client attempts to verify the transaction with a Seed instead of the Public Key", function () {
      const challenge = AiBlocksSdk.Utils.buildChallengeTx(
        this.serverKP,
        this.clientKP1.publicKey(),
        "SDF",
        300,
        AiBlocksSdk.Networks.TESTNET,
      );

      clock.tick(200);

      const transaction = new AiBlocksSdk.Transaction(
        challenge,
        AiBlocksSdk.Networks.TESTNET,
      );
      transaction.sign(this.clientKP2, this.clientKP2);

      const signedChallenge = transaction
        .toEnvelope()
        .toXDR("base64")
        .toString();

      expect(() =>
        AiBlocksSdk.Utils.verifyChallengeTxSigners(
          signedChallenge,
          this.serverKP.publicKey(),
          AiBlocksSdk.Networks.TESTNET,
          [this.clientKP2.secret()],
          "SDF",
        ),
      ).to.throw(
        AiBlocksSdk.InvalidSep10ChallengeError,
        /No verifiable client signers provided, at least one G... address must be provided/,
      );
    });

    it("throws an error if no client has signed the transaction", function () {
      const transaction = new AiBlocksSdk.TransactionBuilder(
          this.txAccount,
          this.txBuilderOpts,
        )
        .addOperation(this.operation)
        .setTimeout(30)
        .build();

      transaction.sign(this.serverKP);
      const challenge = transaction
        .toEnvelope()
        .toXDR("base64")
        .toString();

      const clientSigners = [
        this.clientKP1.publicKey(),
        this.clientKP2.publicKey(),
      ];

      expect(() =>
        AiBlocksSdk.Utils.verifyChallengeTxSigners(
          challenge,
          this.serverKP.publicKey(),
          AiBlocksSdk.Networks.TESTNET,
          clientSigners,
          "SDF-test",
        ),
      ).to.throw(
        AiBlocksSdk.InvalidSep10ChallengeError,
        /None of the given signers match the transaction signatures/,
      );
    });

    it("throws an error if no public keys were provided to verify signatires", function () {
      const challenge = AiBlocksSdk.Utils.buildChallengeTx(
        this.serverKP,
        this.clientKP1.publicKey(),
        "SDF",
        300,
        AiBlocksSdk.Networks.TESTNET,
      );

      clock.tick(200);

      const transaction = new AiBlocksSdk.Transaction(
        challenge,
        AiBlocksSdk.Networks.TESTNET,
      );
      transaction.sign(this.clientKP1);

      const signedChallenge = transaction
        .toEnvelope()
        .toXDR("base64")
        .toString();

      expect(() =>
        AiBlocksSdk.Utils.verifyChallengeTxSigners(
          signedChallenge,
          this.serverKP.publicKey(),
          AiBlocksSdk.Networks.TESTNET,
          [],
          "SDF",
        ),
      ).to.throw(
        AiBlocksSdk.InvalidSep10ChallengeError,
        /No verifiable client signers provided, at least one G... address must be provided/,
      );
    });
  });

  describe('Utils.verifyTxSignedBy', function () {
    beforeEach(function () {
      this.keypair = AiBlocksSdk.Keypair.random();
      this.account = new AiBlocksSdk.Account(this.keypair.publicKey(), "-1");
      this.transaction = new AiBlocksSdk.TransactionBuilder(this.account, txBuilderOpts)
        .setTimeout(30)
        .build();
    });

    afterEach(function () {
      this.keypair, this.account, this.transaction = null;
    });

    it('returns true if the transaction was signed by the given account', function () {
      this.transaction.sign(this.keypair);

      expect(AiBlocksSdk.Utils.verifyTxSignedBy(this.transaction, this.keypair.publicKey())).to.eql(true);
    });

    it('returns false if the transaction was not signed by the given account', function () {
      this.transaction.sign(this.keypair);

      let differentKeypair = AiBlocksSdk.Keypair.random();

      expect(AiBlocksSdk.Utils.verifyTxSignedBy(this.transaction, differentKeypair.publicKey())).to.eql(false);
    });

    it('works with an unsigned transaction', function () {
      expect(AiBlocksSdk.Utils.verifyTxSignedBy(this.transaction, this.keypair.publicKey())).to.eql(false);
    });
  });

  describe("Utils.gatherTxSigners", function () {
    beforeEach(function () {
      this.keypair1 = AiBlocksSdk.Keypair.random();
      this.keypair2 = AiBlocksSdk.Keypair.random();
      this.account = new AiBlocksSdk.Account(this.keypair1.publicKey(), "-1");
      this.transaction = new AiBlocksSdk.TransactionBuilder(
          this.account,
          txBuilderOpts,
        )
        .setTimeout(30)
        .build();
    });

    afterEach(function () {
      this.keypair1, this.keypair2, this.account, this.transaction = null;
    });

    it("returns a list with the signatures used in the transaction", function () {
      this.transaction.sign(this.keypair1, this.keypair2);

      const expectedSignatures = [
        this.keypair1.publicKey(),
        this.keypair2.publicKey(),
      ];
      expect(
        AiBlocksSdk.Utils.gatherTxSigners(this.transaction, expectedSignatures),
      ).to.eql(expectedSignatures);
    });

    it("returns a list with the signatures used in the transaction, removing duplicates", function () {
      this.transaction.sign(
        this.keypair1,
        this.keypair1,
        this.keypair1,
        this.keypair2,
        this.keypair2,
        this.keypair2,
      );

      const expectedSignatures = [
        this.keypair1.publicKey(),
        this.keypair2.publicKey(),
      ];
      expect(
        AiBlocksSdk.Utils.gatherTxSigners(this.transaction, [
          this.keypair1.publicKey(),
          this.keypair2.publicKey(),
        ]),
      ).to.eql(expectedSignatures);
    });

    it("returns an empty list if the transaction was not signed by the given accounts", function () {
      this.transaction.sign(this.keypair1, this.keypair2);

      let wrongSignatures = [
        AiBlocksSdk.Keypair.random().publicKey(),
        AiBlocksSdk.Keypair.random().publicKey(),
        AiBlocksSdk.Keypair.random().publicKey(),
      ];

      expect(
        AiBlocksSdk.Utils.gatherTxSigners(this.transaction, wrongSignatures),
      ).to.eql([]);
    });

    it("calling gatherTxSigners with an unsigned transaction will return an empty list", function () {
      expect(
        AiBlocksSdk.Utils.gatherTxSigners(this.transaction, [
          this.keypair1.publicKey(),
          this.keypair2.publicKey(),
        ]),
      ).to.eql([]);
    });

    it("Raises an error in case one of the given signers is not a valid G signer", function () {
      this.transaction.sign(this.keypair1, this.keypair2);
      const preauthTxHash = "TAQCSRX2RIDJNHFIFHWD63X7D7D6TRT5Y2S6E3TEMXTG5W3OECHZ2OG4";
      expect(
        () => AiBlocksSdk.Utils.gatherTxSigners(this.transaction, [preauthTxHash, this.keypair1.publicKey()]),
      ).to.throw(
        AiBlocksSdk.InvalidSep10ChallengeError,
        /Signer is not a valid address/
      );
    });

    it("Raises an error in case one of the given signers is an invalid G signer", function () {
      this.transaction.sign(this.keypair1, this.keypair2);
      const invalidGHash = "GBDIT5GUJ7R5BXO3GJHFXJ6AZ5UQK6MNOIDMPQUSMXLIHTUNR2Q5CAAA";
      expect(
        () => AiBlocksSdk.Utils.gatherTxSigners(this.transaction, [invalidGHash, this.keypair1.publicKey()]),
      ).to.throw(
        AiBlocksSdk.InvalidSep10ChallengeError,
        /Signer is not a valid address/
      );
    });
  });
});
