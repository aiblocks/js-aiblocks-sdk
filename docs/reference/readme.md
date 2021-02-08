---
title: Overview
---
The JavaScript AiBlocks SDK facilitates integration with the [AiBlocks Millennium API server](https://github.com/aiblocks/go/tree/master/services/millennium) and submission of AiBlocks transactions, either on Node.js or in the browser. It has two main uses: [querying Millennium](#querying-millennium) and [building, signing, and submitting transactions to the AiBlocks network](#building-transactions).

[Building and installing js-aiblocks-sdk](https://github.com/aiblocks/js-aiblocks-sdk)<br>
[Examples of using js-aiblocks-sdk](./examples.md)

# Querying Millennium
js-aiblocks-sdk gives you access to all the endpoints exposed by Millennium.

## Building requests
js-aiblocks-sdk uses the [Builder pattern](https://en.wikipedia.org/wiki/Builder_pattern) to create the requests to send
to Millennium. Starting with a [server](https://aiblocks.github.io/js-aiblocks-sdk/Server.html) object, you can chain methods together to generate a query.
(See the [Millennium reference](https://www.aiblocks.io/developers/reference/) documentation for what methods are possible.)
```js
var AiBlocksSdk = require('aiblocks-sdk');
var server = new AiBlocksSdk.Server('https://millennium-testnet.aiblocks.io');
// get a list of transactions that occurred in ledger 1400
server.transactions()
    .forLedger(1400)
    .call().then(function(r){ console.log(r); });

// get a list of transactions submitted by a particular account
server.transactions()
    .forAccount('GASOCNHNNLYFNMDJYQ3XFMI7BYHIOCFW3GJEOWRPEGK2TDPGTG2E5EDW')
    .call().then(function(r){ console.log(r); });
```

Once the request is built, it can be invoked with `.call()` or with `.stream()`. `call()` will return a
[promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise) to the response given by Millennium.

## Streaming requests
Many requests can be invoked with `stream()`. Instead of returning a promise like `call()` does, `.stream()` will return an `EventSource`.
Millennium will start sending responses from either the beginning of time or from the point specified with `.cursor()`.
(See the [Millennium reference](https://www.aiblocks.io/developers/millennium/reference/streaming.html) documentation to learn which endpoints support streaming.)

For example, to log instances of transactions from a particular account:

```javascript
var AiBlocksSdk = require('aiblocks-sdk')
var server = new AiBlocksSdk.Server('https://millennium-testnet.aiblocks.io');
var lastCursor=0; // or load where you left off

var txHandler = function (txResponse) {
    console.log(txResponse);
};

var es = server.transactions()
    .forAccount(accountAddress)
    .cursor(lastCursor)
    .stream({
        onmessage: txHandler
    })
```

## Handling responses

### XDR
The transaction endpoints will return some fields in raw [XDR](https://www.aiblocks.io/developers/guides/concepts/xdr.html)
form. You can convert this XDR to JSON using the `.fromXDR()` method.

An example of re-writing the txHandler from above to print the XDR fields as JSON:

```javascript
var txHandler = function (txResponse) {
    console.log( JSON.stringify(AiBlocksSdk.xdr.TransactionEnvelope.fromXDR(txResponse.envelope_xdr, 'base64')) );
    console.log( JSON.stringify(AiBlocksSdk.xdr.TransactionResult.fromXDR(txResponse.result_xdr, 'base64')) );
    console.log( JSON.stringify(AiBlocksSdk.xdr.TransactionMeta.fromXDR(txResponse.result_meta_xdr, 'base64')) );
};

```


### Following links
The [HAL format](https://www.aiblocks.io/developers/millennium/reference/responses.html) links returned with the Millennium response are converted into functions you can call on the returned object.
This allows you to simply use `.next()` to page through results. It also makes fetching additional info, as in the following example, easy:

```js
server.payments()
    .limit(1)
    .call()
    .then(function(response){
        // will follow the transactions link returned by Millennium
        response.records[0].transaction().then(function(txs){
            console.log(txs);
        });
    });
```


# Transactions

## Building transactions

See the [Building Transactions](https://www.aiblocks.io/developers/js-aiblocks-base/reference/building-transactions.html) guide for information about assembling a transaction.

## Submitting transactions
Once you have built your transaction, you can submit it to the AiBlocks network with `Server.submitTransaction()`.
```js
const AiBlocksSdk = require('aiblocks-sdk')
const server = new AiBlocksSdk.Server('https://millennium-testnet.aiblocks.io');

(async function main() {
    const account = await server.loadAccount(publicKey);

    /*
        Right now, we have one function that fetches the base fee.
        In the future, we'll have functions that are smarter about suggesting fees,
        e.g.: `fetchCheapFee`, `fetchAverageFee`, `fetchPriorityFee`, etc.
    */
    const fee = await server.fetchBaseFee();

    const transaction = new AiBlocksSdk.TransactionBuilder(account, { fee, networkPassphrase: AiBlocksSdk.Networks.TESTNET })
        .addOperation(
            // this operation funds the new account with DLO
            AiBlocksSdk.Operation.payment({
                destination: "GASOCNHNNLYFNMDJYQ3XFMI7BYHIOCFW3GJEOWRPEGK2TDPGTG2E5EDW",
                asset: AiBlocksSdk.Asset.native(),
                amount: "2"
            })
        )
        .setTimeout(30)
        .build();

    // sign the transaction
    transaction.sign(AiBlocksSdk.Keypair.fromSecret(secretString));

    try {
        const transactionResult = await server.submitTransaction(transaction);
        console.log(transactionResult);
    } catch (err) {
        console.error(err);
    }
})()
```
