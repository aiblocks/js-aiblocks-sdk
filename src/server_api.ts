import { Asset, AssetType } from "aiblocks-base-sdk";
import { Omit } from "utility-types";
import { Millennium } from "./millennium_api";

/* tslint:disable-next-line: no-namespace */
export namespace ServerApi {
  export interface CollectionPage<
    T extends Millennium.BaseResponse = Millennium.BaseResponse
  > {
    records: T[];
    next: () => Promise<CollectionPage<T>>;
    prev: () => Promise<CollectionPage<T>>;
  }

  export interface CallFunctionTemplateOptions {
    cursor?: string | number;
    limit?: number;
    order?: "asc" | "desc";
  }

  export type CallFunction<
    T extends Millennium.BaseResponse = Millennium.BaseResponse
  > = () => Promise<T>;
  export type CallCollectionFunction<
    T extends Millennium.BaseResponse = Millennium.BaseResponse
  > = (options?: CallFunctionTemplateOptions) => Promise<CollectionPage<T>>;

  export interface AccountRecordSigners {
    key: string;
    weight: number;
    type: string;
  }
  export interface AccountRecord extends Millennium.BaseResponse {
    id: string;
    paging_token: string;
    account_id: string;
    sequence: string;
    subentry_count: number;
    home_domain?: string;
    inflation_destination?: string;
    last_modified_ledger: number;
    thresholds: Millennium.AccountThresholds;
    flags: Millennium.Flags;
    balances: Millennium.BalanceLine[];
    signers: AccountRecordSigners[];
    data: (options: { value: string }) => Promise<{ value: string }>;
    data_attr: {
      [key: string]: string;
    };
    sponsor?: string;
    num_sponsoring: number;
    num_sponsored: number;
    effects: CallCollectionFunction<EffectRecord>;
    offers: CallCollectionFunction<OfferRecord>;
    operations: CallCollectionFunction<OperationRecord>;
    payments: CallCollectionFunction<PaymentOperationRecord>;
    trades: CallCollectionFunction<TradeRecord>;
  }

  export interface ClaimableBalanceRecord extends Millennium.BaseResponse {
    id: string;
    paging_token: string;
    asset: string;
    amount: string;
    sponsor?: string;
    last_modified_ledger: number;
    claimants: Millennium.Claimant[];
  }

  export interface EffectRecord extends Millennium.BaseResponse {
    account: string;
    paging_token: string;
    type_i: string;
    type: string;
    created_at: string;
    id: string;

    // account_debited / credited / trustline_created
    amount?: any;
    asset_type?: string;
    asset_code?: string;
    asset_issuer?: string;

    // trustline_created / removed
    limit?: string;

    // signer_created
    public_key?: string;

    // trade
    offer_id?: number | string;
    bought_amount?: string;
    bought_asset_type?: string;
    bought_asset_code?: string;
    bought_asset_issuer?: string;
    sold_amount?: string;
    sold_asset_type?: string;
    sold_asset_code?: string;
    sold_asset_issuer?: string;

    // account_created
    starting_balance?: string;

    // These were retrieved from the go repo, not through direct observation
    // so they could be wrong!

    // account thresholds updated
    low_threshold?: number;
    med_threshold?: number;
    high_threshold?: number;

    // home domain updated
    home_domain?: string;

    // account flags updated
    auth_required_flag?: boolean;
    auth_revokable_flag?: boolean;

    // seq bumped
    new_seq?: number | string;

    // signer created / removed / updated
    weight?: number;
    key?: string;

    // trustline authorized / deauthorized
    trustor?: string;

    // claimable_balance_created
    // claimable_balance_claimant_created
    // claimable_balance_claimed
    balance_id?: string;
    asset?: string;
    predicate?: Millennium.Predicate;

    // account_sponsorship_created
    // trustline_sponsorship_created
    // claimable_balance_sponsorship_created
    // signer_sponsorship_created
    // data_sponsorship_created
    sponsor?: string;
    signer?: string;
    data_name?: string;

    // account_sponsorship_updated
    // account_sponsorship_removed
    // trustline_sponsorship_updated
    // trustline_sponsorship_removed
    // claimable_balance_sponsorship_updated
    // claimable_balance_sponsorship_removed
    // signer_sponsorship_updated
    // signer_sponsorship_removed
    // data_sponsorship_updated
    // data_sponsorship_removed
    new_sponsor?: string;
    former_sponsor?: string;

    operation?: CallFunction<OperationRecord>;
    precedes?: CallFunction<EffectRecord>;
    succeeds?: CallFunction<EffectRecord>;
  }

  export interface LedgerRecord extends Millennium.BaseResponse {
    id: string;
    paging_token: string;
    hash: string;
    prev_hash: string;
    sequence: number;
    transaction_count: number;
    operation_count: number;
    tx_set_operation_count: number | null;
    closed_at: string;
    total_coins: string;
    fee_pool: string;
    base_fee: number;
    base_reserve: string;
    max_tx_set_size: number;
    protocol_version: number;
    header_xdr: string;
    base_fee_in_sectors: number;
    base_reserve_in_sectors: number;

    effects: CallCollectionFunction<EffectRecord>;
    operations: CallCollectionFunction<OperationRecord>;
    self: CallFunction<LedgerRecord>;
    transactions: CallCollectionFunction<TransactionRecord>;
  }

  export interface OfferAsset {
    asset_type: AssetType;
    asset_code?: string;
    asset_issuer?: string;
  }

  export interface OfferRecord extends Millennium.BaseResponse {
    id: number | string;
    paging_token: string;
    seller: string;
    selling: OfferAsset;
    buying: OfferAsset;
    amount: string;
    price_r: Millennium.PriceRShorthand;
    price: string;
    last_modified_ledger: number;
    last_modified_time: string;
    sponsor?: string;
  }

  import OperationResponseType = Millennium.OperationResponseType;
  import OperationResponseTypeI = Millennium.OperationResponseTypeI;
  export interface BaseOperationRecord<
    T extends OperationResponseType = OperationResponseType,
    TI extends OperationResponseTypeI = OperationResponseTypeI
  > extends Millennium.BaseOperationResponse<T, TI> {
    self: CallFunction<OperationRecord>;
    succeeds: CallFunction<OperationRecord>;
    precedes: CallFunction<OperationRecord>;
    effects: CallCollectionFunction<EffectRecord>;
    transaction: CallFunction<TransactionRecord>;
  }

  export interface CreateAccountOperationRecord
    extends BaseOperationRecord<
        OperationResponseType.createAccount,
        OperationResponseTypeI.createAccount
      >,
      Millennium.CreateAccountOperationResponse {}
  export interface PaymentOperationRecord
    extends BaseOperationRecord<
        OperationResponseType.payment,
        OperationResponseTypeI.payment
      >,
      Millennium.PaymentOperationResponse {
    sender: CallFunction<AccountRecord>;
    receiver: CallFunction<AccountRecord>;
  }
  export interface PathPaymentOperationRecord
    extends BaseOperationRecord<
        OperationResponseType.pathPayment,
        OperationResponseTypeI.pathPayment
      >,
      Millennium.PathPaymentOperationResponse {}
  export interface PathPaymentStrictSendOperationRecord
    extends BaseOperationRecord<
        OperationResponseType.pathPaymentStrictSend,
        OperationResponseTypeI.pathPaymentStrictSend
      >,
      Millennium.PathPaymentStrictSendOperationResponse {}
  export interface ManageOfferOperationRecord
    extends BaseOperationRecord<
        OperationResponseType.manageOffer,
        OperationResponseTypeI.manageOffer
      >,
      Millennium.ManageOfferOperationResponse {}
  export interface PassiveOfferOperationRecord
    extends BaseOperationRecord<
        OperationResponseType.createPassiveOffer,
        OperationResponseTypeI.createPassiveOffer
      >,
      Millennium.PassiveOfferOperationResponse {}
  export interface SetOptionsOperationRecord
    extends BaseOperationRecord<
        OperationResponseType.setOptions,
        OperationResponseTypeI.setOptions
      >,
      Millennium.SetOptionsOperationResponse {}
  export interface ChangeTrustOperationRecord
    extends BaseOperationRecord<
        OperationResponseType.changeTrust,
        OperationResponseTypeI.changeTrust
      >,
      Millennium.ChangeTrustOperationResponse {}
  export interface AllowTrustOperationRecord
    extends BaseOperationRecord<
        OperationResponseType.allowTrust,
        OperationResponseTypeI.allowTrust
      >,
      Millennium.AllowTrustOperationResponse {}
  export interface AccountMergeOperationRecord
    extends BaseOperationRecord<
        OperationResponseType.accountMerge,
        OperationResponseTypeI.accountMerge
      >,
      Millennium.AccountMergeOperationResponse {}
  export interface InflationOperationRecord
    extends BaseOperationRecord<
        OperationResponseType.inflation,
        OperationResponseTypeI.inflation
      >,
      Millennium.InflationOperationResponse {}
  export interface ManageDataOperationRecord
    extends BaseOperationRecord<
        OperationResponseType.manageData,
        OperationResponseTypeI.manageData
      >,
      Millennium.ManageDataOperationResponse {}
  export interface BumpSequenceOperationRecord
    extends BaseOperationRecord<
        OperationResponseType.bumpSequence,
        OperationResponseTypeI.bumpSequence
      >,
      Millennium.BumpSequenceOperationResponse {}
  export interface CreateClaimableBalanceOperationRecord
    extends BaseOperationRecord<
        OperationResponseType.createClaimableBalance,
        OperationResponseTypeI.createClaimableBalance
      >,
      Millennium.CreateClaimableBalanceOperationResponse {}
  export interface ClaimClaimableBalanceOperationRecord
    extends BaseOperationRecord<
        OperationResponseType.claimClaimableBalance,
        OperationResponseTypeI.claimClaimableBalance
      >,
      Millennium.ClaimClaimableBalanceOperationResponse {}
  export interface BeginSponsoringFutureReservesOperationRecord
    extends BaseOperationRecord<
        OperationResponseType.beginSponsoringFutureReserves,
        OperationResponseTypeI.beginSponsoringFutureReserves
      >,
      Millennium.BeginSponsoringFutureReservesOperationResponse {}
  export interface EndSponsoringFutureReservesOperationRecord
    extends BaseOperationRecord<
        OperationResponseType.endSponsoringFutureReserves,
        OperationResponseTypeI.endSponsoringFutureReserves
      >,
      Millennium.EndSponsoringFutureReservesOperationResponse {}
  export interface RevokeSponsorshipOperationRecord
    extends BaseOperationRecord<
        OperationResponseType.revokeSponsorship,
        OperationResponseTypeI.revokeSponsorship
      >,
      Millennium.RevokeSponsorshipOperationResponse {}

  export type OperationRecord =
    | CreateAccountOperationRecord
    | PaymentOperationRecord
    | PathPaymentOperationRecord
    | ManageOfferOperationRecord
    | PassiveOfferOperationRecord
    | SetOptionsOperationRecord
    | ChangeTrustOperationRecord
    | AllowTrustOperationRecord
    | AccountMergeOperationRecord
    | InflationOperationRecord
    | ManageDataOperationRecord
    | BumpSequenceOperationRecord
    | PathPaymentStrictSendOperationRecord
    | CreateClaimableBalanceOperationRecord
    | ClaimClaimableBalanceOperationRecord
    | BeginSponsoringFutureReservesOperationRecord
    | EndSponsoringFutureReservesOperationRecord
    | RevokeSponsorshipOperationRecord;

  export interface TradeRecord extends Millennium.BaseResponse {
    id: string;
    paging_token: string;
    ledger_close_time: string;
    offer_id: string;
    base_offer_id: string;
    base_account: string;
    base_amount: string;
    base_asset_type: string;
    base_asset_code?: string;
    base_asset_issuer?: string;
    counter_offer_id: string;
    counter_account: string;
    counter_amount: string;
    counter_asset_type: string;
    counter_asset_code?: string;
    counter_asset_issuer?: string;
    base_is_seller: boolean;

    base: CallFunction<AccountRecord>;
    counter: CallFunction<AccountRecord>;
    operation: CallFunction<OperationRecord>;
  }

  export interface TransactionRecord
    extends Omit<Millennium.TransactionResponse, "ledger"> {
    ledger_attr: Millennium.TransactionResponse["ledger"];

    account: CallFunction<AccountRecord>;
    effects: CallCollectionFunction<EffectRecord>;
    ledger: CallFunction<LedgerRecord>;
    operations: CallCollectionFunction<OperationRecord>;
    precedes: CallFunction<TransactionRecord>;
    self: CallFunction<TransactionRecord>;
    succeeds: CallFunction<TransactionRecord>;
  }

  export interface AssetRecord extends Millennium.BaseResponse {
    asset_type: AssetType.credit4 | AssetType.credit12;
    asset_code: string;
    asset_issuer: string;
    paging_token: string;
    amount: string;
    num_accounts: number;
    flags: Millennium.Flags;
  }

  export interface OrderbookRecord extends Millennium.BaseResponse {
    bids: Array<{
      price_r: {
        d: number;
        n: number;
      };
      price: string;
      amount: string;
    }>;
    asks: Array<{
      price_r: {
        d: number;
        n: number;
      };
      price: string;
      amount: string;
    }>;
    base: Asset;
    counter: Asset;
  }

  export interface PaymentPathRecord extends Millennium.BaseResponse {
    path: Array<{
      asset_code: string;
      asset_issuer: string;
      asset_type: string;
    }>;
    source_amount: string;
    source_asset_type: string;
    source_asset_code: string;
    source_asset_issuer: string;
    destination_amount: string;
    destination_asset_type: string;
    destination_asset_code: string;
    destination_asset_issuer: string;
  }
}
