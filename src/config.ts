import { Config, NetworkConfigurations } from "./types";

/**
 * Allowed Networks
 */
export const allowedNetworks = ["polygon", "mainnet", "arbitrum", "base", "flare", "bsc"];

/**
 * Allowed tokens
 */
export const allowedTokens = [
    "PAI",
    "LOCK",
    "IOEN",
    "MNW",
    "TFT",
    "WLTH",
    "PAID",
    "LUCKY",
    "WPOL",
    "QUICK_OLD",
    "QUICK_NEW",
    "WFLR",
    "sFLR",
    "cysFLR",
];

/**
 * Allowed Durations
 */
export const allowedDurations = ["daily", "weekly", "monthly"];

export const tokenConfig: Config = {
    IOEN: {
        symbol: "IOEN",
        decimals: 18,
        network: "polygon",
        address: "0xd0e9c8f5fae381459cf07ec506c1d2896e8b5df6",
        poolsV2: ["0x316bc12871c807020ef8c1bc7771061c4e7a04ed"],
        poolsV3: [],
    },
    MNW: {
        symbol: "MNW",
        decimals: 18,
        network: "polygon",
        address: "0x3c59798620e5fec0ae6df1a19c6454094572ab92",
        poolsV2: [],
        poolsV3: [
            "0x1abc944412f8c8cfafb3fe7764fa954739aab044",
            "0x426a2c62bf87d377d7d2efa13da2556109dfd098",
        ],
    },
    WPOL: {
        symbol: "WPOL",
        network: "polygon",
        decimals: 18,
        address: "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270",
        poolsV2: [
            "0x604229c960e5cacf2aaeac8be68ac07ba9df81c3",
            "0x6e7a5fafcec6bb1e78bae2a1f0b612012bf14827",
            "0xcd353f79d9fade311fc3119b841e1f456b54e858",
            "0xc84f479bf220e38ba3bd0262049bad47aaa673ee",
            "0xc84f479bf220e38ba3bd0262049bad47aaa673ee",
            "0x65d43b64e3b31965cd5ea367d4c2b94c03084797",
            "0xd32f3139a214034a0f9777c87ee0a064c1ff6ae2",
            "0x55ff76bffc3cdd9d5fdbbc2ece4528ecce45047e",
            "0x4db1087154cd5b33fa275a88b183619f1a6f6614",
            "0x8a4ceb4dffa238539c5d62ce424980e8fdb21ebc",
            "0xeef611894ceae652979c9d0dae1deb597790c6ee",
            "0x5e58e0ced3a272caeb8ba00f4a4c2805df6be495",
        ],
        poolsV3: [
            "0x9b08288c3be4f62bbf8d1c20ac9c5e6f9467d8b7",
            "0xa374094527e1673a86de625aa59517c5de346d32",
            "0xae81fac689a1b4b1e06e7ef4a2ab4cd8ac0a087d",
            "0x5b41eedcfc8e0ae47493d4945aa1ae4fe05430ff",
            "0x781067ef296e5c4a4203f81c593274824b7c185d",
            "0x88f3c15523544835ff6c738ddb30995339ad57d6",
            "0xfe530931da161232ec76a7c3bea7d36cf3811a0d",
            "0x21988c9cfd08db3b5793c2c6782271dc94749251",
            "0x8312a29a91d9fac706f4d2adeb1fa4540fad1673",
            "0x3bfcb475e528f54246f1847ec0e7b53dd88bda4e",
            "0x13c5cb6762eb5dc01c515cf85a2d8d74fc21a18d",
            "0xcaf7834cab11e00123d3510abbbcb912b39ab456",
            "0xec15624fbb314eb05baad4ca49b7904c0cb6b645",
            "0x8c862d100b94d95a49d91958c9e8c2c348d00f04",
            "0xef45e5814cc503fd3691dcd9128f4200d4e46d02",
        ],
    },
    QUICK_OLD: {
        symbol: "QUICK",
        network: "polygon",
        decimals: 18,
        address: "0xb5c064f955d8e7f38fe0460c556a72987494ee17",
        poolsV2: [
            "0xf3eb2f17eafbf35e92c965a954c6e7693187057d",
            "0x60e70705b52a4a5bdc1d8614426ba5016a68ab38",
            "0x747375305b825c49fb97ee0ac09d19ec9ef94bd2",
        ],
        poolsV3: [
            "0x9f1a8caf3c8e94e43aa64922d67dff4dc3e88a42",
            "0xde2d1fd2e8238aba80a5b80c7262e4833d92f624",
            "0x022df0b3341b3a0157eea97dd024a93f7496d631",
            "0x14ef96a0f7d738db906bdd5260e46aa47b1e6e45",
            "0xa14b36e7ab49bb04570d334c4cf9df609340b17b",
        ],
    },
    QUICK_NEW: {
        symbol: "QUICK",
        network: "polygon",
        decimals: 18,
        address: "0x831753dd7087cac61ab5644b308642cc1c33dc13",
        poolsV2: [
            "0x019ba0325f1988213d448b3472fa1cf8d07618d7",
            "0x1bd06b96dd42ada85fdd0795f3b4a79db914add5",
            "0x1f1e4c845183ef6d50e9609f16f6f9cae43bc9cb",
            "0x8b1fd78ad67c7da09b682c5392b65ca7caa101b9",
            "0xdea8f0f1e6e98c6aee891601600e5fba294b5e36",
        ],
        poolsV3: ["0x1d7f2e4295981af5cc005d936ac437588b353596"],
    },
    TFT: {
        symbol: "TFT",
        decimals: 7,
        network: "bsc",
        address: "0x8f0fb159380176d324542b3a7933f0c2fd0c2bbf",
        poolsV2: ["0x4a2dbaa979a3f4cfb8004ea5743faf159dd2665a"],
        poolsV3: [],
    },
    cysFLR: {
        symbol: "cysFLR",
        decimals: 18,
        network: "flare",
        address: "0x19831cfb53a0dbead9866c43557c1d48dff76567",
        poolsV2: ["0x823e88d5506a0aa22a04e91fba8b6e40878b21b2"],
        poolsV3: [
            "0x265cc3246f9226432ea614d62e277dd6617721c8",
            "0xcfab1baf26e44ac39a55444a00fc8da2ce87d8a5",
            "0x3f5e66faa7b41a7a3b7bb223046f2b7b3afd2643",
            "0x6c58ac774f31abe010437681c5365fd8d6a43adc",
            "0x2dfbdb28013d7c7a93ecff227c3b20bb3050bc2e",
            "0x060b54a68581ddff1285c8d1f9b78898d63a46c7",
            "0xa68c2d999cbf838f14387961ce828990d5ad5ea0",
            "0x91dad908a9cd0c07d46b84a0322890bafa4c5d9a",
            "0x6a200b0191daa9f877a13b720ebec676827da5a8",
        ],
    },
    cUSDX: {
        symbol: "cUSDX",
        decimals: 6,
        network: "flare",
        address: "0xfe2907dfa8db6e320cdbf45f0aa888f6135ec4f8",
        poolsV2: [],
        poolsV3: [
            "0x53676e77e352dc28eb86a3ccbc19a3ed7b63e304",
            "0x9f850f2acfab04176dde13e047ad1ca4b2b1395d",
            "0x073fd421aba7bb72442b0d6ff4fd6da1a802525e",
            "0x395242d0e9e7d579e76c188a85afd382531680e6",
        ],
    },
    PAID: {
        symbol: "PAID",
        network: "base",
        decimals: 18,
        address: "0x655a51e6803faf50d4ace80fa501af2f29c856cf",
        poolsV2: [],
        poolsV3: ["0x1e1367dcebe168554e82552e0e659a4116926d10"],
    },
    LUCKY: {
        symbol: "LUCKY",
        network: "base",
        decimals: 18,
        address: "0x2c002ffec41568d138acc36f5894d6156398d539",
        poolsV2: [],
        poolsV3: ["0xb36d05a38eb28c424338c7549cc2947bcb3eda9e"],
    },
    WLTH: {
        symbol: "WLTH",
        network: "base",
        decimals: 18,
        address: "0x99b2b1a2adb02b38222adcd057783d7e5d1fcc7d",
        poolsV2: [],
        poolsV3: ["0x1536ee1506e24e5a36be99c73136cd82907a902e"],
    },
    WFLR: {
        symbol: "WFLR",
        network: "flare",
        decimals: 18,
        address: "0x1d80c49bbbcd1c0911346656b529df9e5c2f783d",
        poolsV2: [
            "0xeb9299f3f40913cf4b71001ac9f66fd81144573a",
            "0x2eb870bd9ed4f9f99dc348e2a76ab2e69cf7b525",
            "0x86c9b716c9e69f5234587b58a6bc14c9aece19a3",
            "0x32df95c940c445699f7f005d3892c33799677dc7",
            "0xb1ec7ef55fa2e84eb6ff9ff0fa1e33387f892f68",
            "0xdf4b31b81d59eca0cfc30ecb2beb36eaebaf7a49",
            "0x3f50f880041521738fa88c46cdf7e0d8eeb11aa2",
            "0xff1b852a0582bf87e69fad114560595fc5cf1212",
            "0x66485b4fbaa124f86437c00220b3b769ff2a0c91",
            "0x53de93596e1b4362dd9c02f9ad0a7bf78f54ce9e",
            "0x80a08bbabb0a5c51a9ae53211df09ef23debd4f3",
            "0xc1c44bbe0764104098c0b6aa0ba5e97892a1cf30",
            "0x32fd7858393918a984da6ee279eca27f630a1c02",
        ],
        poolsV3: [
            "0x346ddd9858708adaf9e1879264a5c1584fb541be",
            "0x3bc1ecbcd645e525508c570a0ff04480a5614a86",
            "0xc9baba3f36ccaa54675deecc327ec7eaa48cb97d",
            "0xaff8e67248e81eb63941b7ef769758e42cef9189",
            "0x164857e59cde0848910dac791650da52db736dc2",
            "0x4a885ed3ec3f3e657440422e93c15a73edf6a909",
            "0x7666ab2482257578113194b9a5e9d3bd7dc759d9",
            "0x9a3215f8b0d128816f75175c9fd74e7ebbd987da",
            "0x507ba799d81c8e7848fa4e0c966bf96a7e28b5cd",
            "0xe6fbab907141a578c51326c25300950a1c38b27c",
            "0x46ff03da3081e5976eeff542cdaa6453d2dd1286",
            "0xcaa52e02504e6c637e307e0a3d9675e659016cd8",
            "0xf9b24c2a90e27b452911686866559e582ab006b6",
            "0x45a914901529f0ca96812ee5e6158f6684beb11e",
            "0xeee7bb7f370b7d5afd39131710975ce649ca6d3f",
            "0x8a08af86e010757d6d9af209293e587433a734e5",
        ],
    },
    sFLR: {
        symbol: "sFLR",
        network: "flare",
        decimals: 18,
        address: "0x12e605bc104e93b45e1ad99f9e555f659051c2bb",
        poolsV2: [
            "0x3f50f880041521738fa88c46cdf7e0d8eeb11aa2",
            "0x7e8eb77feb4b3fe2c58b493df6ce38875806bebb",
            "0x0a6b1db2c92fbda09520cf6dc50c63da39a6fc66",
            "0x9150536ce451be336de88dbe22bd8bc5f9fca498",
            "0xf06eebf7a66c80760bd8343a6bce84c9d61879ee",
            "0xb7c6f8cff4d5b7266225f624e03a27be0998c726",
        ],
        poolsV3: [
            "0xc9baba3f36ccaa54675deecc327ec7eaa48cb97d",
            "0x9a3215f8b0d128816f75175c9fd74e7ebbd987da",
            "0x25b4f3930934f0a3cbb885c624ecee75a2917144",
            "0x46ff03da3081e5976eeff542cdaa6453d2dd1286",
            "0xd75d57a09e42e6aa336c274d08164b04aa7e7ddb",
            "0x2dbec0d3812af232ae185e84b9cf172f34a9acb9",
            "0x4f5df684a9177f612dfd3697a71b782020de1940",
            "0x623fe69b78c6bbaa71bcce2ae2c7dea57cfc5ea3",
            "0xb95bf4c67eec434db728ae673d92b8ffbe982e7f",
            "0x71f62232d470f87ad8db616fb68b0a69b5a3b594",
            "0xa6ed1a04b9b6b0a6cf3926510546baf5bbe44e5e",
            "0x4f53ac9fce3e9739b3e589015888a683c24fac04",
            "0x8c5c1ab9b96ad885e2c5bd83d30f2d109ea20311",
            "0x4ddc7854e0d3008d2b85e5ed1529d726711ed05c",
            "0x942a493fe65172e42d276d07a612b678914ea402",
        ],
    },
    PAI: {
        symbol: "PAI",
        network: "mainnet",
        decimals: 18,
        address: "0x13e4b8cffe704d3de6f19e52b201d92c21ec18bd",
        poolsV2: ["0x24b8c320a4505057cb1e4808d200535ec5320817"],
        poolsV3: [],
    },
    LOCK: {
        symbol: "LOCK",
        network: "mainnet",
        decimals: 18,
        address: "0x922d8563631b03c2c4cf817f4d18f6883aba0109",
        poolsV2: [],
        poolsV3: ["0x7d45a2557becd766a285d07a4701f5c64d716e2f"],
    },
    UMJA: {
        symbol: "UMJA",
        network: "arbitrum",
        decimals: 18,
        address: "0x16A500Aec6c37F84447ef04E66c57cfC6254cF92",
        poolsV2: [],
        poolsV3: ["0x551579dc8bdfa60f6d21816fb25429ee49b570d5"],
    },
};

export const networkConfig: NetworkConfigurations = {
    polygon: {
        chainId: 137,
        rpc: "https://rpc.ankr.com/polygon",
        blockTime: 2.1,
        subgraphUrl:
            "https://api.goldsky.com/api/public/project_clv14x04y9kzi01saerx7bxpg/subgraphs/ob4-matic/2024-12-13-d2b4/gn",
        stables: [
            {
                address: "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359",
                symbol: "USDC",
                decimals: 6,
            },
            {
                address: "0xc2132d05d31c914a87c6611c10748aeb04b58e8f",
                symbol: "USDT",
                decimals: 6,
            },
            {
                address: "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619",
                symbol: "WETH",
                decimals: 18,
            },
            {
                address: "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270",
                symbol: "WPOL",
                decimals: 18,
            },
        ],
    },
    arbitrum: {
        chainId: 42161,
        rpc: "https://rpc.ankr.com/arbitrum",
        blockTime: 1.2,
        subgraphUrl:
            "https://api.goldsky.com/api/public/project_clv14x04y9kzi01saerx7bxpg/subgraphs/ob4-arbitrum-one/2024-12-13-7435/gn",
        stables: [
            {
                address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
                symbol: "USDC",
                decimals: 6,
            },
            {
                address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
                symbol: "WETH",
                decimals: 18,
            },
        ],
    },
    bsc: {
        chainId: 56,
        rpc: "https://rpc.ankr.com/bsc",
        blockTime: 3,
        subgraphUrl:
            "https://api.goldsky.com/api/public/project_clv14x04y9kzi01saerx7bxpg/subgraphs/ob4-bsc/2024-12-13-2244/gn",
        stables: [
            {
                address: "0xe9e7cea3dedca5984780bafc599bd69add087d56",
                symbol: "BUSD",
                decimals: 18,
            },
            {
                address: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
                symbol: "WBNB",
                decimals: 18,
            },
            {
                address: "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",
                symbol: "USDC",
                decimals: 18,
            },
        ],
    },
    base: {
        chainId: 8453,
        rpc: "https://mainnet.base.org",
        blockTime: 12,
        subgraphUrl:
            "https://api.goldsky.com/api/public/project_clv14x04y9kzi01saerx7bxpg/subgraphs/ob4-base/2024-12-13-9c39/gn",
        stables: [
            {
                address: "0x4200000000000000000000000000000000000006",
                symbol: "WETH",
                decimals: 18,
            },
            {
                address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
                symbol: "USDC",
                decimals: 6,
            },
        ],
    },
    flare: {
        chainId: 14,
        blockTime: 3,
        rpc: "https://rpc.ankr.com/flare",
        subgraphUrl:
            "https://api.goldsky.com/api/public/project_clv14x04y9kzi01saerx7bxpg/subgraphs/ob4-flare/2024-12-13-9dc7/gn",
        stables: [],
    },
    mainnet: {
        chainId: 1,
        blockTime: 12,
        rpc: "https://rpc.ankr.com/eth",
        subgraphUrl:
            "https://api.goldsky.com/api/public/project_clv14x04y9kzi01saerx7bxpg/subgraphs/ob4-mainnet/2024-12-13-7f22/gn",
        stables: [
            {
                address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
                symbol: "WETH",
                decimals: 18,
            },
            {
                address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
                symbol: "USDC",
                decimals: 6,
            },
            {
                address: "0xdac17f958d2ee523a2206206994597c13d831ec7",
                symbol: "USDT",
                decimals: 6,
            },
        ],
    },
};
