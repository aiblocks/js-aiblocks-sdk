import { CallBuilder } from "./call_builder";
import { ServerApi } from "./server_api";

/**
 * Creates a new {@link LedgerCallBuilder} pointed to server defined by serverUrl.
 * Do not create this object directly, use {@link Server#ledgers}.
 *
 * @see [All Ledgers](https://www.aiblocks.io/developers/millennium/reference/endpoints/ledgers-all.html)
 * @constructor
 * @class LedgerCallBuilder
 * @extends CallBuilder
 * @param {string} serverUrl Millennium server URL.
 */
export class LedgerCallBuilder extends CallBuilder<
  ServerApi.CollectionPage<ServerApi.LedgerRecord>
> {
  constructor(serverUrl: URI) {
    super(serverUrl);
    this.url.segment("ledgers");
  }

  /**
   * Provides information on a single ledger.
   * @param {number|string} sequence Ledger sequence
   * @returns {LedgerCallBuilder} current LedgerCallBuilder instance
   */
  public ledger(sequence: number | string): this {
    this.filter.push(["ledgers", sequence.toString()]);
    return this;
  }
}
