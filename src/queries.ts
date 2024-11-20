// Define the GraphQL query
export const query = `
  query OrdersListQuery($skip: Int = 0, $first: Int = 1000) {
    orders(
      orderBy: timestampAdded
      orderDirection: desc
      skip: $skip
      first: $first
      where: { active: true }
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
      orderbook {
        id
      }
      active
      timestampAdded
      trades {
        id
        inputVaultBalanceChange {
          newVaultBalance
          amount
          oldVaultBalance
        }
        outputVaultBalanceChange {
          amount
          newVaultBalance
          oldVaultBalance
        }
        timestamp
      }
    }
  }
`;

export const tradeQuery = `query OrderTakesListQuery($orderHash: Bytes!, $skip: Int = 0, $first: Int = 1000) {
  trades(orderBy: timestamp, orderDirection: desc, skip: $skip, first: $first, where: {
    order_: {
      orderHash: $orderHash
    }
  }) {
    tradeEvent {
      transaction {
        id
        from
        timestamp
      }
    }
    outputVaultBalanceChange {
      amount
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
    }
  }
}`