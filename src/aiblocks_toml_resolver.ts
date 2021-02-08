import axios from "axios";
import toml from "toml";
import { Config } from "./config";

// AIBLOCKS_TOML_MAX_SIZE is the maximum size of aiblocks.toml file
export const AIBLOCKS_TOML_MAX_SIZE = 100 * 1024;

// axios timeout doesn't catch missing urls, e.g. those with no response
// so we use the axios cancel token to ensure the timeout
const CancelToken = axios.CancelToken;

/**
 * AiBlocksTomlResolver allows resolving `aiblocks.toml` files.
 */
export class AiBlocksTomlResolver {
  /**
   * Returns a parsed `aiblocks.toml` file for a given domain.
   * ```js
   * AiBlocksSdk.AiBlocksTomlResolver.resolve('acme.com')
   *   .then(aiblocksToml => {
   *     // aiblocksToml in an object representing domain aiblocks.toml file.
   *   })
   *   .catch(error => {
   *     // aiblocks.toml does not exist or is invalid
   *   });
   * ```
   * @see <a href="https://www.aiblocks.io/developers/guides/concepts/aiblocks-toml.html" target="_blank">AiBlocks.toml doc</a>
   * @param {string} domain Domain to get aiblocks.toml file for
   * @param {object} [opts] Options object
   * @param {boolean} [opts.allowHttp] - Allow connecting to http servers, default: `false`. This must be set to false in production deployments!
   * @param {number} [opts.timeout] - Allow a timeout, default: 0. Allows user to avoid nasty lag due to TOML resolve issue.
   * @returns {Promise} A `Promise` that resolves to the parsed aiblocks.toml object
   */
  public static async resolve(
    domain: string,
    opts: AiBlocksTomlResolver.AiBlocksTomlResolveOptions = {},
  ): Promise<{ [key: string]: any }> {
    const allowHttp =
      typeof opts.allowHttp === "undefined"
        ? Config.isAllowHttp()
        : opts.allowHttp;

    const timeout =
      typeof opts.timeout === "undefined" ? Config.getTimeout() : opts.timeout;

    const protocol = allowHttp ? "http" : "https";

    return axios
      .get(`${protocol}://${domain}/.well-known/aiblocks.toml`, {
        maxContentLength: AIBLOCKS_TOML_MAX_SIZE,
        cancelToken: timeout
          ? new CancelToken((cancel) =>
              setTimeout(
                () => cancel(`timeout of ${timeout}ms exceeded`),
                timeout,
              ),
            )
          : undefined,
        timeout,
      })
      .then((response) => {
        try {
          const tomlObject = toml.parse(response.data);
          return Promise.resolve(tomlObject);
        } catch (e) {
          return Promise.reject(
            new Error(
              `aiblocks.toml is invalid - Parsing error on line ${e.line}, column ${e.column}: ${e.message}`,
            ),
          );
        }
      })
      .catch((err: Error) => {
        if (err.message.match(/^maxContentLength size/)) {
          throw new Error(
            `aiblocks.toml file exceeds allowed size of ${AIBLOCKS_TOML_MAX_SIZE}`,
          );
        } else {
          throw err;
        }
      });
  }
}

/* tslint:disable-next-line: no-namespace */
export namespace AiBlocksTomlResolver {
  export interface AiBlocksTomlResolveOptions {
    allowHttp?: boolean;
    timeout?: number;
  }
}
