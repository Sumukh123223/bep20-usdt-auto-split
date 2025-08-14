const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.WebsocketProvider('wss://bsc.websocket.ankr.com/'));
const walletAddress = process.env.WALLET_ADDRESS; // Get wallet address from environment variables
const tokenAddress = '0x55d398326f99059fF775485246999027B3197955'; // USDT contract address on BSC

// Replace with the actual contract ABI (get it from BSCScan)
const contractABI = [
  // Add the actual ABI here
  {
    "constant": true,
    "inputs": [],
    "name": "totalSupply",
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "name",
    "outputs": [
      {
        "name": "",
        "type": "string"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "symbol",
    "outputs": [
      {
        "name": "",
        "type": "string"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "decimals",
    "outputs": [
      {
        "name": "",
        "type": "uint8"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      {
        "name": "account",
        "type": "address"
      }
    ],
    "name": "balanceOf",
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "name": "recipient",
        "type": "address"
      },
      {
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "transfer",
    "outputs": [
      {
        "name": "",
        "type": "bool"
      }
    ],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

const contract = new web3.eth.Contract(contractABI, tokenAddress);

// Subscribe to Transfer events to your wallet address
web3.eth.subscribe('logs', {
  address: tokenAddress,
  topics: [
    web3.utils.sha3('Transfer(address,address,uint256)'), // Transfer event signature
    null, // From address (null means we listen to all from addresses)
    web3.utils.padLeft(walletAddress, 64) // To address (your wallet address)
  ]
}, async (error, result) => {
  if (error) {
    console.error(error);
  } else {
    // Extract the transaction details
    const transaction = result;
    const amount = web3.utils.hexToNumberString(transaction.data); // The amount received (as string)

    console.log('Received USDT:', amount);

    // Convert the amount to a decimal value for precise calculations
    const decimalAmount = web3.utils.toBN(amount); // Convert the amount to a BigNumber (precise)
    
    // Split the amount (70% to Wallet 1, 30% to Wallet 2)
    const splitAmount70 = decimalAmount.mul(web3.utils.toBN('70')).div(web3.utils.toBN('100')); // 70% of the amount
    const splitAmount30 = decimalAmount.mul(web3.utils.toBN('30')).div(web3.utils.toBN('100')); // 30% of the amount

    // Convert the split amounts back to readable format (string with decimals)
    const splitAmount70Readable = web3.utils.fromWei(splitAmount70, 'mwei'); // Convert back to USDT readable format
    const splitAmount30Readable = web3.utils.fromWei(splitAmount30, 'mwei');

    console.log(`Split Amount (70%): ${splitAmount70Readable} USDT`);
    console.log(`Split Amount (30%): ${splitAmount30Readable} USDT`);

    // Send the split amounts to two different addresses
    await sendTransaction(walletAddress, 'ADDRESS_1', splitAmount70Readable); // Send 70% to Address 1
    await sendTransaction(walletAddress, 'ADDRESS_2', splitAmount30Readable); // Send 30% to Address 2
  }
});

// Function to send USDT to another address
async function sendTransaction(fromAddress, toAddress, amount) {
  const privateKey = process.env.PRIVATE_KEY; // Use environment variable for private key
  const account = web3.eth.accounts.privateKeyToAccount(privateKey);
  const gasPrice = await web3.eth.getGasPrice();
  const gasLimit = 100000; // Gas limit

  // Prepare the transaction data
  const txData = contract.methods.transfer(toAddress, web3.utils.toWei(amount, 'mwei')).encodeABI(); // Convert to mwei for USDT transfer
  
  // Create transaction object
  const tx = {
    from: fromAddress,
    to: tokenAddress,
    gas: gasLimit,
    gasPrice: gasPrice,
    data: txData,
    value: '0', // No BNB value, just USDT transfer
  };

  // Sign the transaction
  const signedTx = await web3.eth.accounts.signTransaction(tx, account.privateKey);

  // Send the signed transaction
  web3.eth.sendSignedTransaction(signedTx.rawTransaction)
    .on('receipt', console.log)
    .on('error', console.error);
}
