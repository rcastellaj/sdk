import { TransactionBlock } from "@mysten/sui.js/transactions";
import { CoinStruct } from "@mysten/sui.js/client";
import { HopApi } from "../api";
import { makeRequest } from "../util";

interface GetTxParams {
  token_in: string;
  token_out: string;
  amount_in: bigint;
  sui_address: string;
  gas_budget: number | 1e9;
}

interface GetTxResponse {
  token_in: string;
  amount_in: bigint;
  token_out: string;
  amount_out: bigint;
  transaction: TransactionBlock;
}

interface InputToken {
  object_id: string,
  coin_type: string,
  amount: bigint
}

async function fetchCoins(client: HopApi, sui_address: string, coin_type: string): Promise<InputToken[]> {
  let coins: CoinStruct[] = [];
  let cursor = null;

  do {
    let coin_response = await client.client.getCoins({
      owner: sui_address,
      coinType: coin_type,
      cursor: cursor,
    });
    coins.push(...coin_response.data);

    if(coin_response.hasNextPage) {
      cursor = coin_response.nextCursor;
    } else {
      cursor = null;
    }
  } while(cursor != null);

  return coins.map(coin_struct => ({
    object_id: coin_struct.coinObjectId,
    coin_type: coin_struct.coinType,
    amount: BigInt(coin_struct.balance)
  }));
}

async function fetchTx(client: HopApi, params: GetTxParams): Promise<GetTxResponse | null> {
  // get input coins
  let user_input_coins: InputToken[] = await fetchCoins(client, params.sui_address, params.token_in);
  let gas_coins: InputToken[] = user_input_coins;

  // gas coins
  if(params.token_in != "0x2::sui::SUI") {
    gas_coins = await fetchCoins(client, params.sui_address, "0x2:sui::SUI");
  }

  const response = await makeRequest('tx', {
    api_key: client.options.api_key,
    data: {
      amount_in: params.amount_in,
      token_in: params.token_in,
      token_out: params.token_out,
      builder_request: {
        sender_address: params.sui_address,
        user_input_coins,
        gas_coins,
        gas_budget: params.gas_budget
      }
    },
    method: 'post'
  });

  if(response != null) {
    const tx_block = TransactionBlock.from(response.tx);
    return {
      token_in: response.trade.amount_in.token,
      token_out: response.trade.amount_out.token,
      amount_in: response.trade.amount_in.amount,
      amount_out: response.trade.amount_out.amount,
      transaction: tx_block
    };
  }

  return null;
}

export { GetTxParams, GetTxResponse, fetchTx };
