/**
 * Use this file to configure your truffle project. It's seeded with some
 * common settings for different networks and features like migrations,
 * compilation and testing. Uncomment the ones you need or modify
 * them to suit your project as necessary.
 *
 * More information about configuration can be found at:
 *
 * trufflesuite.com/docs/advanced/configuration
 *
 * To deploy via Infura you'll need a wallet provider (like @truffle/hdwallet-provider)
 * to sign your transactions before they're sent to a remote public node. Infura accounts
 * are available for free at: infura.io/register.
 *
 * You'll also need a mnemonic - the twelve word phrase the wallet uses to generate
 * public/private key pairs. If you're publishing your code to GitHub make sure you load this
 * phrase from a file you've .gitignored so it doesn't accidentally become public.
 *
 */

const HDWalletProvider = require('@truffle/hdwallet-provider');
var jsonfile = require('jsonfile');
var api_keys = jsonfile.readFileSync('./.api_keys');

module.exports = {
  /**
   * Networks define how you connect to your ethereum client and let you set the
   * defaults web3 uses to send transactions. If you don't specify one truffle
   * will spin up a development blockchain for you on port 9545 when you
   * run `develop` or `test`. You can ask a truffle command to use a specific
   * network from the command line, e.g
   *
   * $ truffle test --network <network-name>
   */

  networks: {
    mainnet: {
      provider: () => new HDWalletProvider(api_keys.mnemonic, api_keys.provider_mainnet),
      network_id: 1, 
      gas: 6721975,
      gasPrice: 25000000000
    },
    bsc: {
      provider: () => new HDWalletProvider(mnemonic, `https://bsc-dataseed.binance.org`),
      network_id: 56,
      confirmations: 20,
      timeoutBlocks: 200,
      skipDryRun: true,
      gas: 6721975,
      gasPrice: 10000000000
    },
    debugbsc: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "56",
      gas: 6721975,
      gasPrice: 100000000000
    },
    ganachecli: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "1",
      gas: 6721975,
      gasPrice: 100000000000
    },
    uitest: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "1",
      gas: 6721975,
      gasPrice: 100000000000
    },
    debug: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "1",
      gas: 6721975,
      gasPrice: 250000000000
    },
  },

  // Set default mocha options here, use special reporters etc.
  mocha: {
    enableTimeouts: false,
    timeout: 100000000
  },

  // Configure your compilers
  compilers: {
    solc: {
       version: "0.6.12",    // Fetch exact version from solc-bin (default: truffle's version)
      // docker: true,        // Use "0.5.1" you've installed locally with docker (default: false)
       settings: {          // See the solidity docs for advice about optimization and evmVersion
         optimizer: {
           enabled: true,
           runs: 200
         }
      //  evmVersion: "byzantium"
      }
    }
  },
  plugins: [
    'truffle-plugin-verify'
  ],
  api_keys: {
    etherscan: api_keys.etherscan
  }
};
