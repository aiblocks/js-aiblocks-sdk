import {
  Account,
  BASE_FEE,
  FeeBumpTransaction,
  Keypair,
  Operation,
  TimeoutInfinite,
  Transaction,
  TransactionBuilder,
} from "aiblocks-base-sdk";
import clone from "lodash/clone";
import randomBytes from "randombytes";
import { InvalidSep10ChallengeError } from "./errors";
import { ServerApi } from "./server_api";

/**
 * @namespace Utils
 */
export namespace Utils {
  /**
   * Returns a valid [SEP0010](https://github.com/aiblocks/aiblocks-protocol/blob/master/ecosystem/sep-0010.md)
   * challenge transaction which you can use for AiBlocks Web Authentication.
   *
   * @see [SEP0010: AiBlocks Web Authentication](https://github.com/aiblocks/aiblocks-protocol/blob/master/ecosystem/sep-0010.md).
   * @function
   * @memberof Utils
   * @param {Keypair} serverKeypair Keypair for server's signing account.
   * @param {string} clientAccountID The aiblocks account that the wallet wishes to authenticate with the server.
   * @param {string} homeDomain The fully qualified domain name of the service requiring authentication
   * @param {number} [timeout=300] Challenge duration (default to 5 minutes).
   * @param {string} networkPassphrase The network passphrase. If you pass this argument then timeout is required.
   * @example
   * import { Utils, Keypair, Networks }  from 'aiblocks-sdk'
   *
   * let serverKeyPair = Keypair.fromSecret("server-secret")
   * let challenge = Utils.buildChallengeTx(serverKeyPair, "client-aiblocks-account-id", "SDF", 300, Networks.TESTNET)
   * @returns {string} A base64 encoded string of the raw TransactionEnvelope xdr struct for the transaction.
   */
  export function buildChallengeTx(
    serverKeypair: Keypair,
    clientAccountID: string,
    homeDomain: string,
    timeout: number = 300,
    networkPassphrase: string,
  ): string {
    if (clientAccountID.startsWith("M")) {
      throw Error(
        "Invalid clientAccountID: multiplexed accounts are not supported.",
      );
    }

    const account = new Account(serverKeypair.publicKey(), "-1");
    const now = Math.floor(Date.now() / 1000);

    // A Base64 digit represents 6 bits, to generate a random 64 bytes
    // base64 string, we need 48 random bytes = (64 * 6)/8
    //
    // Each Base64 digit is in ASCII and each ASCII characters when
    // turned into binary represents 8 bits = 1 bytes.
    const value = randomBytes(48).toString("base64");

    const transaction = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase,
      timebounds: {
        minTime: now,
        maxTime: now + timeout,
      },
    })
      .addOperation(
        Operation.manageData({
          name: `${homeDomain} auth`,
          value,
          source: clientAccountID,
        }),
      )
      .build();

    transaction.sign(serverKeypair);

    return transaction
      .toEnvelope()
      .toXDR("base64")
      .toString();
  }

  /**
   * readChallengeTx reads a SEP 10 challenge transaction and returns the decoded
   * transaction and client account ID contained within.
   *
   * It also verifies that the transaction has been signed by the server.
   *
   * It does not verify that the transaction has been signed by the client or
   * that any signatures other than the server's on the transaction are valid. Use
   * one of the following functions to completely verify the transaction:
   * - verifyChallengeTxThreshold
   * - verifyChallengeTxSigners
   *
   * @see [SEP0010: AiBlocks Web Authentication](https://github.com/aiblocks/aiblocks-protocol/blob/master/ecosystem/sep-0010.md).
   * @function
   * @memberof Utils
   * @param {string} challengeTx SEP0010 challenge transaction in base64.
   * @param {string} serverAccountID The server's aiblocks account (public key).
   * @param {string} networkPassphrase The network passphrase, e.g.: 'Test SDF Network ; September 2015'.
   * @param {string|string[]} [homeDomains] The home domain that is expected to be included in the first Manage Data operation's string key. If an array is provided, one of the domain names in the array must match.
   * @returns {Transaction|string|string} The actual transaction and the aiblocks public key (master key) used to sign the Manage Data operation, and matched home domain.
   */
  export function readChallengeTx(
    challengeTx: string,
    serverAccountID: string,
    networkPassphrase: string,
    homeDomains: string | string[],
  ): { tx: Transaction; clientAccountID: string; matchedHomeDomain: string } {
    if (serverAccountID.startsWith("M")) {
      throw Error(
        "Invalid serverAccountID: multiplexed accounts are not supported.",
      );
    }

    const transaction = TransactionBuilder.fromXDR(
      challengeTx,
      networkPassphrase,
    );

    if (!(transaction instanceof Transaction)) {
      throw new InvalidSep10ChallengeError(
        "Invalid challenge: expected a Transaction but received a FeeBumpTransaction",
      );
    }

    // verify sequence number
    const sequence = Number.parseInt(transaction.sequence, 10);

    if (sequence !== 0) {
      throw new InvalidSep10ChallengeError(
        "The transaction sequence number should be zero",
      );
    }

    // verify transaction source
    if (transaction.source !== serverAccountID) {
      throw new InvalidSep10ChallengeError(
        "The transaction source account is not equal to the server's account",
      );
    }

    // verify operation
    if (transaction.operations.length < 1) {
      throw new InvalidSep10ChallengeError(
        "The transaction should contain at least one operation",
      );
    }

    const [operation, ...subsequentOperations] = transaction.operations;

    if (!operation.source) {
      throw new InvalidSep10ChallengeError(
        "The transaction's operation should contain a source account",
      );
    }
    const clientAccountID: string = operation.source!;

    if (operation.type !== "manageData") {
      throw new InvalidSep10ChallengeError(
        "The transaction's operation type should be 'manageData'",
      );
    }

    // verify timebounds
    if (
      transaction.timeBounds &&
      Number.parseInt(transaction.timeBounds?.maxTime, 10) === TimeoutInfinite
    ) {
      throw new InvalidSep10ChallengeError(
        "The transaction requires non-infinite timebounds",
      );
    }

    if (!validateTimebounds(transaction)) {
      throw new InvalidSep10ChallengeError("The transaction has expired");
    }

    // verify base64
    // if (Buffer.from(operation.value.toString(), "base64").length !== 48) {
    //   throw new InvalidSep10ChallengeError(
    //     "The transaction's operation value should be a 64 bytes base64 random string",
    //   );
    // }

    // verify homeDomains
    if (!homeDomains) {
      throw new InvalidSep10ChallengeError(
        "Invalid homeDomains: a home domain must be provided for verification",
      );
    }

    let matchedHomeDomain;

    if (typeof homeDomains === "string") {
      if (`${homeDomains} auth` === operation.name) {
        matchedHomeDomain = homeDomains;
      }
    } else if (Array.isArray(homeDomains)) {
      matchedHomeDomain = homeDomains.find(
        (domain) => `${domain} auth` === operation.name,
      );
    } else {
      throw new InvalidSep10ChallengeError(
        `Invalid homeDomains: homeDomains type is ${typeof homeDomains} but should be a string or an array`,
      );
    }

    if (!matchedHomeDomain) {
      throw new InvalidSep10ChallengeError(
        "Invalid homeDomains: the transaction's operation key name does not match the expected home domain",
      );
    }

    // verify any subsequent operations are manage data ops and source account is the server
    for (const op of subsequentOperations) {
      if (op.type !== "manageData") {
        throw new InvalidSep10ChallengeError(
          "The transaction has operations that are not of type 'manageData'",
        );
      }
      if (op.source !== serverAccountID) {
        throw new InvalidSep10ChallengeError(
          "The transaction has operations that are unrecognized",
        );
      }
    }

    return { tx: transaction, clientAccountID, matchedHomeDomain };
  }

  /**
   * verifyChallengeTxThreshold verifies that for a SEP 10 challenge transaction
   * all signatures on the transaction are accounted for and that the signatures
   * meet a threshold on an account. A transaction is verified if it is signed by
   * the server account, and all other signatures match a signer that has been
   * provided as an argument, and those signatures meet a threshold on the
   * account.
   *
   * Signers that are not prefixed as an address/account ID strkey (G...) will be
   * ignored.
   *
   * Errors will be raised if:
   *  - The transaction is invalid according to ReadChallengeTx.
   *  - No client signatures are found on the transaction.
   *  - One or more signatures in the transaction are not identifiable as the
   *    server account or one of the signers provided in the arguments.
   *  - The signatures are all valid but do not meet the threshold.
   *
   * @see [SEP0010: AiBlocks Web Authentication](https://github.com/aiblocks/aiblocks-protocol/blob/master/ecosystem/sep-0010.md).
   * @function
   * @memberof Utils
   * @param {string} challengeTx SEP0010 challenge transaction in base64.
   * @param {string} serverAccountID The server's aiblocks account (public key).
   * @param {string} networkPassphrase The network passphrase, e.g.: 'Test SDF Network ; September 2015'.
   * @param {number} threshold The required signatures threshold for verifying this transaction.
   * @param {ServerApi.AccountRecordSigners[]} signerSummary a map of all authorized signers to their weights. It's used to validate if the transaction signatures have met the given threshold.
   * @param {string|string[]} [homeDomains] The home domain(s) that should be included in the first Manage Data operation's string key. Required in verifyChallengeTxSigners() => readChallengeTx().
   * @returns {string[]} The list of signers public keys that have signed the transaction, excluding the server account ID, given that the threshold was met.
   * @example
   *
   * import { Networks, TransactionBuilder, Utils }  from 'aiblocks-sdk';
   *
   * const serverKP = Keypair.random();
   * const clientKP1 = Keypair.random();
   * const clientKP2 = Keypair.random();
   *
   * // Challenge, possibly built in the server side
   * const challenge = Utils.buildChallengeTx(
   *   serverKP,
   *   clientKP1.publicKey(),
   *   "SDF",
   *   300,
   *   Networks.TESTNET
   * );
   *
   * // clock.tick(200);  // Simulates a 200 ms delay when communicating from server to client
   *
   * // Transaction gathered from a challenge, possibly from the client side
   * const transaction = TransactionBuilder.fromXDR(challenge, Networks.TESTNET);
   * transaction.sign(clientKP1, clientKP2);
   * const signedChallenge = transaction
   *         .toEnvelope()
   *         .toXDR("base64")
   *         .toString();
   *
   * // Defining the threshold and signerSummary
   * const threshold = 3;
   * const signerSummary = [
   *    {
   *      key: this.clientKP1.publicKey(),
   *      weight: 1,
   *    },
   *    {
   *      key: this.clientKP2.publicKey(),
   *      weight: 2,
   *    },
   *  ];
   *
   * // The result below should be equal to [clientKP1.publicKey(), clientKP2.publicKey()]
   * Utils.verifyChallengeTxThreshold(signedChallenge, serverKP.publicKey(), Networks.TESTNET, threshold, signerSummary);
   */
  export function verifyChallengeTxThreshold(
    challengeTx: string,
    serverAccountID: string,
    networkPassphrase: string,
    threshold: number,
    signerSummary: ServerApi.AccountRecordSigners[],
    homeDomains: string | string[],
  ): string[] {
    const signers = signerSummary.map((signer) => signer.key);

    const signersFound = verifyChallengeTxSigners(
      challengeTx,
      serverAccountID,
      networkPassphrase,
      signers,
      homeDomains,
    );

    let weight = 0;
    for (const signer of signersFound) {
      const sigWeight =
        signerSummary.find((s) => s.key === signer)?.weight || 0;
      weight += sigWeight;
    }

    if (weight < threshold) {
      throw new InvalidSep10ChallengeError(
        `signers with weight ${weight} do not meet threshold ${threshold}"`,
      );
    }

    return signersFound;
  }

  /**
   * verifyChallengeTxSigners verifies that for a SEP 10 challenge transaction all
   * signatures on the transaction are accounted for. A transaction is verified
   * if it is signed by the server account, and all other signatures match a signer
   * that has been provided as an argument (as the accountIDs list). Additional signers
   * can be provided that do not have a signature, but all signatures must be matched
   * to a signer (accountIDs) for verification to succeed. If verification succeeds,
   * a list of signers that were found is returned, not including the server account ID.
   *
   * Signers that are not prefixed as an address/account ID strkey (G...) will be ignored.
   *
   * Errors will be raised if:
   *  - The transaction is invalid according to ReadChallengeTx.
   *  - No client signatures are found on the transaction.
   *  - One or more signatures in the transaction are not identifiable as the
   *    server account or one of the signers provided in the arguments.
   *
   * @see [SEP0010: AiBlocks Web Authentication](https://github.com/aiblocks/aiblocks-protocol/blob/master/ecosystem/sep-0010.md).
   * @function
   * @memberof Utils
   * @param {string} challengeTx SEP0010 challenge transaction in base64.
   * @param {string} serverAccountID The server's aiblocks account (public key).
   * @param {string} networkPassphrase The network passphrase, e.g.: 'Test SDF Network ; September 2015'.
   * @param {string[]} signers The signers public keys. This list should contain the public keys for all signers that have signed the transaction.
   * @param {string|string[]} [homeDomains] The home domain(s) that should be included in the first Manage Data operation's string key. Required in readChallengeTx().
   * @returns {string[]} The list of signers public keys that have signed the transaction, excluding the server account ID.
   * @example
   *
   * import { Networks, TransactionBuilder, Utils }  from 'aiblocks-sdk';
   *
   * const serverKP = Keypair.random();
   * const clientKP1 = Keypair.random();
   * const clientKP2 = Keypair.random();
   *
   * // Challenge, possibly built in the server side
   * const challenge = Utils.buildChallengeTx(
   *   serverKP,
   *   clientKP1.publicKey(),
   *   "SDF",
   *   300,
   *   Networks.TESTNET
   * );
   *
   * // clock.tick(200);  // Simulates a 200 ms delay when communicating from server to client
   *
   * // Transaction gathered from a challenge, possibly from the client side
   * const transaction = TransactionBuilder.fromXDR(challenge, Networks.TESTNET);
   * transaction.sign(clientKP1, clientKP2);
   * const signedChallenge = transaction
   *         .toEnvelope()
   *         .toXDR("base64")
   *         .toString();
   *
   * // The result below should be equal to [clientKP1.publicKey(), clientKP2.publicKey()]
   * Utils.verifyChallengeTxSigners(signedChallenge, serverKP.publicKey(), Networks.TESTNET, threshold, [clientKP1.publicKey(), clientKP2.publicKey()]);
   */
  export function verifyChallengeTxSigners(
    challengeTx: string,
    serverAccountID: string,
    networkPassphrase: string,
    signers: string[],
    homeDomains: string | string[],
  ): string[] {
    // Read the transaction which validates its structure.
    const { tx } = readChallengeTx(
      challengeTx,
      serverAccountID,
      networkPassphrase,
      homeDomains,
    );

    // Ensure the server account ID is an address and not a seed.
    let serverKP: Keypair;
    try {
      serverKP = Keypair.fromPublicKey(serverAccountID); // can throw 'Invalid AiBlocks public key'
    } catch (err) {
      throw new Error(
        "Couldn't infer keypair from the provided 'serverAccountID': " +
          err.message,
      );
    }

    // Deduplicate the client signers and ensure the server is not included
    // anywhere we check or output the list of signers.
    const clientSigners = new Set<string>();
    for (const signer of signers) {
      // Ignore the server signer if it is in the signers list. It's
      // important when verifying signers of a challenge transaction that we
      // only verify and return client signers. If an account has the server
      // as a signer the server should not play a part in the authentication
      // of the client.
      if (signer === serverKP.publicKey()) {
        continue;
      }

      // Ignore non-G... account/address signers.
      if (signer.charAt(0) !== "G") {
        continue;
      }

      clientSigners.add(signer);
    }

    // Don't continue if none of the signers provided are in the final list.
    if (clientSigners.size === 0) {
      throw new InvalidSep10ChallengeError(
        "No verifiable client signers provided, at least one G... address must be provided",
      );
    }

    // Verify all the transaction's signers (server and client) in one
    // hit. We do this in one hit here even though the server signature was
    // checked in the ReadChallengeTx to ensure that every signature and signer
    // are consumed only once on the transaction.
    const allSigners: string[] = [
      serverKP.publicKey(),
      ...Array.from(clientSigners),
    ];

    const signersFound: string[] = gatherTxSigners(tx, allSigners);

    // Confirm we matched a signature to the server signer.
    if (signersFound.indexOf(serverKP.publicKey()) === -1) {
      throw new InvalidSep10ChallengeError(
        "Transaction not signed by server: '" + serverKP.publicKey() + "'",
      );
    }

    // Confirm we matched at least one given signer with the transaction signatures
    if (signersFound.length === 1) {
      throw new InvalidSep10ChallengeError(
        "None of the given signers match the transaction signatures",
      );
    }

    // Confirm all signatures, including the server signature, were consumed by a signer:
    if (signersFound.length !== tx.signatures.length) {
      throw new InvalidSep10ChallengeError(
        "Transaction has unrecognized signatures",
      );
    }

    // Remove the server public key before returning
    signersFound.splice(signersFound.indexOf(serverKP.publicKey()), 1);

    return signersFound;
  }

  /**
   * Verifies if a transaction was signed by the given account id.
   *
   * @function
   * @memberof Utils
   * @param {Transaction} transaction
   * @param {string} accountID
   * @example
   * let keypair = Keypair.random();
   * const account = new AiBlocksSdk.Account(keypair.publicKey(), "-1");
   *
   * const transaction = new TransactionBuilder(account, { fee: 100 })
   *    .setTimeout(30)
   *    .build();
   *
   * transaction.sign(keypair)
   * Utils.verifyTxSignedBy(transaction, keypair.publicKey())
   * @returns {boolean}.
   */
  export function verifyTxSignedBy(
    transaction: FeeBumpTransaction | Transaction,
    accountID: string,
  ): boolean {
    return gatherTxSigners(transaction, [accountID]).length !== 0;
  }

  /**
   *
   * gatherTxSigners checks if a transaction has been signed by one or more of
   * the given signers, returning a list of non-repeated signers that were found to have
   * signed the given transaction.
   *
   * @function
   * @memberof Utils
   * @param {Transaction} transaction the signed transaction.
   * @param {string[]} signers The signers public keys.
   * @example
   * let keypair1 = Keypair.random();
   * let keypair2 = Keypair.random();
   * const account = new AiBlocksSdk.Account(keypair1.publicKey(), "-1");
   *
   * const transaction = new TransactionBuilder(account, { fee: 100 })
   *    .setTimeout(30)
   *    .build();
   *
   * transaction.sign(keypair1, keypair2)
   * Utils.gatherTxSigners(transaction, [keypair1.publicKey(), keypair2.publicKey()])
   * @returns {string[]} a list of signers that were found to have signed the transaction.
   */
  export function gatherTxSigners(
    transaction: FeeBumpTransaction | Transaction,
    signers: string[],
  ): string[] {
    const hashedSignatureBase = transaction.hash();

    const txSignatures = clone(transaction.signatures);
    const signersFound = new Set<string>();

    for (const signer of signers) {
      if (txSignatures.length === 0) {
        break;
      }

      let keypair: Keypair;
      try {
        keypair = Keypair.fromPublicKey(signer); // This can throw a few different errors
      } catch (err) {
        throw new InvalidSep10ChallengeError(
          "Signer is not a valid address: " + err.message,
        );
      }

      for (let i = 0; i < txSignatures.length; i++) {
        const decSig = txSignatures[i];

        if (!decSig.hint().equals(keypair.signatureHint())) {
          continue;
        }

        if (keypair.verify(hashedSignatureBase, decSig.signature())) {
          signersFound.add(signer);
          txSignatures.splice(i, 1);
          break;
        }
      }
    }

    return Array.from(signersFound);
  }

  /**
   * Verifies if the current date is within the transaction's timebonds
   *
   * @function
   * @memberof Utils
   * @param {Transaction} transaction the transaction whose timebonds will be validated.
   * @returns {boolean} returns true if the current time is within the transaction's [minTime, maxTime] range.
   */
  function validateTimebounds(transaction: Transaction): boolean {
    if (!transaction.timeBounds) {
      return false;
    }

    const now = Math.floor(Date.now() / 1000);
    const { minTime, maxTime } = transaction.timeBounds;

    return (
      now >= Number.parseInt(minTime, 10) && now <= Number.parseInt(maxTime, 10)
    );
  }
}
