---
title: Basic Examples
---

- [Creating a payment Transaction](#creating-a-payment-transaction)
- [Loading an account's transaction history](#loading-an-accounts-transaction-history)
- [Streaming payment events](#streaming-payment-events)

## Creating a payment transaction

The `js-aiblocks-sdk` exposes the [`TransactionBuilder`](https://aiblocks.github.io/js-aiblocks-base/TransactionBuilder.html) class from `js-aiblocks-base`.  There are more examples of [building transactions here](https://www.aiblocks.io/developers/js-aiblocks-base/reference/base-examples.html). All those examples can be signed and submitted to AiBlocks in a similar manner as is done below.

In this example, the destination account must exist. The example is written
using modern Javascript, but `await` calls can also be rendered with promises.

```javascript
// Create, sign, and submit a transaction using JS AiBlocks SDK.

// Assumes that you have the following items:
// 1. Secret key of a funded account to be the source account
// 2. Public key of an existing account as a recipient
//    These two keys can be created and funded by the friendbot at
//    https://laboratory.aiblocks.io under the heading "Quick Start: Test Account"
// 3. Access to JS AiBlocks SDK (https://github.com/aiblocks/js-aiblocks-sdk)
//    either through Node.js or in the browser.

// This code can be run in the browser at https://laboratory.aiblocks.io
// That site exposes a global AiBlocksSdk object you can use.
// To run this code in the Chrome, open the console tab in the DevTools.
// The hotkey to open the DevTools console is Ctrl+Shift+J or (Cmd+Opt+J on Mac).
const AiBlocksSdk = require('aiblocks-sdk');

// The source account is the account we will be signing and sending from.
const sourceSecretKey = 'SCZANGBA5YHTNYVVV4C3U252E2B6P6F5T3U6MM63WBSBZATAQI3EBTQ4';

// Derive Keypair object and public key (that starts with a G) from the secret
const sourceKeypair = AiBlocksSdk.Keypair.fromSecret(sourceSecretKey);
const sourcePublicKey = sourceKeypair.publicKey();

const receiverPublicKey = 'GAIRISXKPLOWZBMFRPU5XRGUUX3VMA3ZEWKBM5MSNRU3CHV6P4PYZ74D';

// Configure AiBlocksSdk to talk to the millennium instance hosted by AiBlocks.io
// To use the live network, set the hostname to 'millennium.aiblocks.io'
const server = new AiBlocksSdk.Server('https://millennium-testnet.aiblocks.io');

(async function main() {
  // Transactions require a valid sequence number that is specific to this account.
  // We can fetch the current sequence number for the source account from Millennium.
  const account = await server.loadAccount(sourcePublicKey);


  // Right now, there's one function that fetches the base fee.
  // In the future, we'll have functions that are smarter about suggesting fees,
  // e.g.: `fetchCheapFee`, `fetchAverageFee`, `fetchPriorityFee`, etc.
  const fee = await server.fetchBaseFee();


  const transaction = new AiBlocksSdk.TransactionBuilder(account, {
      fee,
      // Uncomment the following line to build transactions for the live network. Be
      // sure to also change the millennium hostname.
      // networkPassphrase: AiBlocksSdk.Networks.PUBLIC,
      networkPassphrase: AiBlocksSdk.Networks.TESTNET
    })
    // Add a payment operation to the transaction
    .addOperation(AiBlocksSdk.Operation.payment({
      destination: receiverPublicKey,
      // The term native asset refers to delos
      asset: AiBlocksSdk.Asset.native(),
      // Specify 350.1234567 delos. Delos are divisible to seven digits past
      // the decimal. They are represented in JS AiBlocks SDK in string format
      // to avoid errors from the use of the JavaScript Number data structure.
      amount: '350.1234567',
    }))
    // Make this transaction valid for the next 30 seconds only
    .setTimeout(30)
    // Uncomment to add a memo (https://www.aiblocks.io/developers/guides/concepts/transactions.html)
    // .addMemo(AiBlocksSdk.Memo.text('Hello world!'))
    .build();

  // Sign this transaction with the secret key
  // NOTE: signing is transaction is network specific. Test network transactions
  // won't work in the public network. To switch networks, use the Network object
  // as explained above (look for AiBlocksSdk.Network).
  transaction.sign(sourceKeypair);

  // Let's see the XDR (encoded in base64) of the transaction we just built
  console.log(transaction.toEnvelope().toXDR('base64'));

  // Submit the transaction to the Millennium server. The Millennium server will then
  // submit the transaction into the network for us.
  try {
    const transactionResult = await server.submitTransaction(transaction);
    console.log(JSON.stringify(transactionResult, null, 2));
    console.log('\nSuccess! View the transaction at: ');
    console.log(transactionResult._links.transaction.href);
  } catch (e) {
    console.log('An error has occured:');
    console.log(e);
  }
})();
```

## Loading an account's transaction history

Let's say you want to look at an account's transaction history.  You can use the `transactions()` command and pass in the account address to `forAccount` as the resource you're interested in.

```javascript
const AiBlocksSdk = require('aiblocks-sdk')
const server = new AiBlocksSdk.Server('https://millennium-testnet.aiblocks.io');
const accountId = 'GBBORXCY3PQRRDLJ7G7DWHQBXPCJVFGJ4RGMJQVAX6ORAUH6RWSPP6FM';

server.transactions()
    .forAccount(accountId)
    .call()
    .then(function (page) {
        console.log('Page 1: ');
        console.log(page.records);
        return page.next();
    })
    .then(function (page) {
        console.log('Page 2: ');
        console.log(page.records);
    })
    .catch(function (err) {
        console.log(err);
    });
```

## Streaming payment events

js-aiblocks-sdk provides streaming support for Millennium endpoints using `EventSource`.  You can pass a function to handle any events that occur on the stream.

Try submitting a transaction (via the guide above) while running the following code example.
```javascript
const AiBlocksSdk = require('aiblocks-sdk')
const server = new AiBlocksSdk.Server('https://millennium-testnet.aiblocks.io');

// Get a message any time a payment occurs. Cursor is set to "now" to be notified
// of payments happening starting from when this script runs (as opposed to from
// the beginning of time).
const es = server.payments()
  .cursor('now')
  .stream({
    onmessage: function (message) {
      console.log(message);
    }
  })
```

For more on streaming events, please check out [the Millennium documentation](https://www.aiblocks.io/developers/millennium/reference/streaming.html) and this [guide to server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events).
