/**
 * Query to fetch orders
 */
export const fetchOrderQuery = `
  query OrdersListQuery($skip: Int = 0, $first: Int = 1000) {
    orders(
      orderBy: timestampAdded
      orderDirection: desc
      skip: $skip
      first: $first
    ) {
      orderHash
      owner
      outputs {
        id
        token {
          id
          address
          name
          symbol
          decimals
        }
        balance
        vaultId
      }
      inputs {
        id
        token {
          id
          address
          name
          symbol
          decimals
        }
        balance
        vaultId
      }
      removeEvents{
        transaction{
          id
          timestamp
        }
      }
      addEvents{
        transaction{
          id
          timestamp
        }
      }
      orderbook {
        id
      }
      active
      timestampAdded
      trades(first: 1000) {
        id
      }
    }
  }
`;

/**
 * Query to fetch trades under a particular order
 */
export const fetchTradesQuery = `query OrderTakesListQuery($orderHash: Bytes!, $skip: Int = 0, $first: Int = 1000) {
  trades(orderBy: timestamp, orderDirection: desc, skip: $skip, first: $first, where: {
    order_: {
      orderHash: $orderHash
    }
  }) {
    timestamp
    tradeEvent {
      transaction {
        id
        from
        timestamp
      }
    }
    outputVaultBalanceChange {
      amount
      oldVaultBalance
      newVaultBalance
      vault {
        token {
          id
          address
          name
          symbol
          decimals
        }
      }
    }
    inputVaultBalanceChange {
      vault {
        token {
          id
          address
          name
          symbol
          decimals
        }
      }
      amount
      oldVaultBalance
      newVaultBalance
    }
  }
}`;

export const vaultDepositsQuery = `query VaultDeposits($vaultId: String!, $first: Int = 1000, $skip: Int = 0) {
  deposits(
    first: $first
    skip: $skip
    where: { vault_: { id: $vaultId } }
  ) {
    id
    amount
  }
}`;

export const vaultWithdrawalQuery = `query VaultWithdrawals($vaultId: String!, $first: Int = 1000, $skip: Int = 0) {
  withdrawals(
    first: $first
    skip: $skip
    where: { vault_: { id: $vaultId } }
  ) {
    id
    amount
  }
}`;
