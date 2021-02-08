// tslint:disable-next-line: no-reference
/// <reference path="../types/dom-monkeypatch.d.ts" />

/* tslint:disable:no-var-requires */
require("es6-promise").polyfill();
const version = require("../package.json").version;

// Expose all types
export * from "./millennium_api";
export * from "./server_api";

// aiblocks-sdk classes to expose
export * from "./account_response";
export * from "./errors";
export { Config } from "./config";
export { Server } from "./server";
export {
  FederationServer,
  FEDERATION_RESPONSE_MAX_SIZE,
} from "./federation_server";
export {
  AiBlocksTomlResolver,
  AIBLOCKS_TOML_MAX_SIZE,
} from "./aiblocks_toml_resolver";
export {
  default as MillenniumAxiosClient,
  SERVER_TIME_MAP,
  getCurrentServerTime,
} from "./millennium_axios_client";
export * from "./utils";

// expose classes and functions from aiblocks-base-sdk
export * from "aiblocks-base-sdk";

export { version };

export default module.exports;
