<div align="center">
<img alt="AiBlocks" src="https://raw.githubusercontent.com/aiblocks/.github/master/aiblocks-logo.png" width="558" />
<br/>
<strong>Creating equitable access to the global financial system</strong>
<h1>js-aiblocks-sdk</h1>
</div>
<p align="center">
<a href="https://travis-ci.com/aiblocks/js-aiblocks-sdk"><img alt="Build Status" src="https://travis-ci.com/aiblocks/js-aiblocks-sdk.svg?branch=master" /></a>
<a href="https://coveralls.io/github/aiblocks/js-aiblocks-sdk?branch=master"><img alt="Coverage Status" src="https://coveralls.io/repos/aiblocks/js-aiblocks-sdk/badge.svg?branch=master&service=github" /></a>
</p>

js-aiblocks-sdk is a Javascript library for communicating with a
[AiBlocks Millennium server](https://github.com/aiblocks/go/tree/master/services/millennium).
It is used for building AiBlocks apps either on Node.js or in the browser.

It provides:

- a networking layer API for Millennium endpoints.
- facilities for building and signing transactions, for communicating with a
  AiBlocks Millennium instance, and for submitting transactions or querying network
  history.

### aiblocks-sdk vs aiblocks-base

aiblocks-sdk is a high-level library that serves as client-side API for Millennium.
[aiblocks-base](https://github.com/aiblocks/js-aiblocks-base) is lower-level
library for creating AiBlocks primitive constructs via XDR helpers and wrappers.

**Most people will want aiblocks-sdk instead of aiblocks-base.** You should only
use aiblocks-base if you know what you're doing!

If you add `aiblocks-sdk` to a project, **do not add `aiblocks-base`!** Mis-matching
versions could cause weird, hard-to-find bugs. `aiblocks-sdk` automatically
installs `aiblocks-base` and exposes all of its exports in case you need them.

> **Important!** The Node.js version of the `aiblocks-base` (`aiblocks-sdk` dependency) package
> uses the [`sodium-native`](https://www.npmjs.com/package/sodium-native) package as
> an [optional dependency](https://docs.npmjs.com/files/package.json#optionaldependencies). `sodium-native` is
> a low level binding to [libsodium](https://github.com/jedisct1/libsodium),
> (an implementation of [Ed25519](https://ed25519.cr.yp.to/) signatures).
> If installation of `sodium-native` fails, or it is unavailable, `aiblocks-base` (and `aiblocks-sdk`) will
> fallback to using the [`tweetnacl`](https://www.npmjs.com/package/tweetnacl) package implementation.
>
> If you are using `aiblocks-sdk`/`aiblocks-base` in a browser you can ignore
> this. However, for production backend deployments you should be
> using `sodium-native`. If `sodium-native` is successfully installed and working the
> `AiBlocksSdk.FastSigning` variable will return `true`.

## Quick start

Using npm to include js-aiblocks-sdk in your own project:

```shell
npm install --save aiblocks-sdk
```

Alternatively, you can use cdnjs in a browser:

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/aiblocks-sdk/{version}/aiblocks-sdk.js"></script>
````

## Install

### To use as a module in a Node.js project

1. Install it using npm:

```shell
npm install --save aiblocks-sdk
```

2. require/import it in your JavaScript:

```js
var AiBlocksSdk = require('aiblocks-sdk');
```

### To self host for use in the browser

1. Install it using [bower](http://bower.io):

```shell
bower install aiblocks-sdk
```

2. Include it in the browser:

```html
<script src="./bower_components/aiblocks-sdk/aiblocks-sdk.js"></script>
<script>
  console.log(AiBlocksSdk);
</script>
```

If you don't want to use install Bower, you can copy built JS files from the
[bower-js-aiblocks-sdk repo](https://github.com/aiblocks/bower-js-aiblocks-sdk).

### To use the [cdnjs](https://cdnjs.com/libraries/aiblocks-sdk) hosted script in the browser

1. Instruct the browser to fetch the library from
   [cdnjs](https://cdnjs.com/libraries/aiblocks-sdk), a 3rd party service that
   hosts js libraries:

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/aiblocks-sdk/{version}/aiblocks-sdk.js"></script>
<script>
  console.log(AiBlocksSdk);
</script>
```

Note that this method relies using a third party to host the JS library. This
may not be entirely secure.

Make sure that you are using the latest version number. They can be found on the
[releases page in Github](https://github.com/aiblocks/js-aiblocks-sdk/releases).

### To develop and test js-aiblocks-sdk itself

1. Clone the repo:

```shell
git clone https://github.com/aiblocks/js-aiblocks-sdk.git
```

2. Install dependencies inside js-aiblocks-sdk folder:

```shell
cd js-aiblocks-sdk
npm install
```

3. Install Node 10.16.3

Because we support earlier versions of Node, please install and develop on Node
10.16.3 so you don't get surprised when your code works locally but breaks in CI.

Here's out to install `nvm` if you haven't: https://github.com/creationix/nvm

```shell
nvm install

# if you've never installed 10.16.3 before you'll want to re-install yarn
npm install -g yarn
```

If you work on several projects that use different Node versions, you might it
helpful to install this automatic version manager:
https://github.com/wbyoung/avn

4. Observe the project's code style

While you're making changes, make sure to run the linter-watcher to catch any
   linting errors (in addition to making sure your text editor supports ESLint)

```shell
node_modules/.bin/gulp watch
````

If you're working on a file not in `src`, limit your code to Node 6.16 ES! See
what's supported here: https://node.green/ (The reason is that our npm library
must support earlier versions of Node, so the tests need to run on those
versions.)

### How to use with React-Native

1. Add the following postinstall script:
```
yarn rn-nodeify --install url,events,https,http,util,stream,crypto,vm,buffer --hack --yarn
```
2. `yarn add -D rn-nodeify`
3. Uncomment `require('crypto')` on shim.js
4. `react-native link react-native-randombytes`
5. Create file `rn-cli.config.js`
```
module.exports = {
  resolver: {
    extraNodeModules: require("node-libs-react-native"),
  },
};
```
6. Add `import "./shim";` to the top of `index.js`
7. `yarn add aiblocks-sdk`

There is also a [sample](https://github.com/fnando/rn-aiblocks-sdk-sample) that you can follow.


## Usage

For information on how to use js-aiblocks-sdk, take a look at the
[Developers site](https://www.aiblocks.io/developers/js-aiblocks-sdk/reference/).

There is also API Documentation
[here](https://www.aiblocks.io/developers/millennium/reference/index.html).

## Testing

To run all tests:

```shell
gulp test
```

To run a specific set of tests:

```shell
gulp test:node
gulp test:browser
```

To generate and check the documentation site:

```shell
# install the `serve` command if you don't have it already
npm install -g serve

# generate the docs files
npm run docs

# get these files working in a browser
cd jsdoc && serve .

# you'll be able to browse the docs at http://localhost:5000
```

## Documentation

Documentation for this repo lives in
[Developers site](https://www.aiblocks.io/developers/js-aiblocks-sdk/reference/).

## Contributing

For information on how to contribute, please refer to our
[contribution guide](https://github.com/aiblocks/js-aiblocks-sdk/blob/master/CONTRIBUTING.md).

## Publishing to npm

```
npm version [<newversion> | major | minor | patch | premajor | preminor | prepatch | prerelease]
```

A new version will be published to npm **and** Bower by Travis CI.

npm >=2.13.0 required. Read more about
[npm version](https://docs.npmjs.com/cli/version).

## License

js-aiblocks-sdk is licensed under an Apache-2.0 license. See the
[LICENSE](https://github.com/aiblocks/js-aiblocks-sdk/blob/master/LICENSE) file
for details.
