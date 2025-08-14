import { ethers } from "ethers";
import dotenv from "dotenv";
dotenv.config();

// ==== CONFIG ====
const RPC_URL = "https://bsc-dataseed.binance.org/"; // BSC Mainnet
const USDT_ADDRESS = "0x55d398326f99059fF775485246999027B3197955"; // BEP-20 USDT
const MY_WALLET = process.env.MY_WALLET; // Your main wallet address
const PRIVATE_KEY = process.env.PRIVATE_KEY; // Main wallet private key
const WALLET_1 = process.env.WALLET_1; // First target wallet
const WALLET_2 = process.env.WALLET_2; // Second target wallet
const RATIO_1 = parseFloat(process.env.RATIO_1 || "70"); // Wallet 1 %
const RATIO_2 = parseFloat(process.env.RATIO_2 || "30"); // Wallet 2 %
const MIN_AMOUNT = parseFloat(process.env.MIN_AMOUNT || "1"); // Minimum USDT to split

// Ratio check
if (RATIO_1 + RATIO_2 !== 100) {
  console.error("❌ Error: RATIO_1 + RATIO_2 must equal 100");
  process.exit(1);
}

// ==== BEP-20 ABI ====
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "event Transfer(address indexed from, address indexed to, uint256 value)"
];

// ==== PROVIDER & CONTRACT ====
const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const usdt = new ethers.Contract(USDT_ADDRESS, ERC20_ABI, wallet);

console.log(`✅ Auto-Split BEP-20 USDT bot started: ${RATIO_1}% / ${RATIO_2}%`);
console.log(`📢 Listening for incoming transfers to ${MY_WALLET}...`);

provider.on({
  address: USDT_ADDRESS,
  topics: [
    ethers.id("Transfer(address,address,uint256)"),
    null,
    ethers.zeroPadValue(MY_WALLET, 32)
  ]
}, async (log) => {
  try {
    const parsed = usdt.interface.parseLog(log);
    const amount = Number(ethers.formatUnits(parsed.args.value, 18));
    console.log(`💰 Received ${amount} USDT`);

    if (amount >= MIN_AMOUNT) {
      const amount1 = (amount * RATIO_1) / 100;
      const amount2 = (amount * RATIO_2) / 100;

      console.log(`➡️ Sending ${amount1} USDT to ${WALLET_1}`);
      await (await usdt.transfer(WALLET_1, ethers.parseUnits(amount1.toString(), 18))).wait();

      console.log(`➡️ Sending ${amount2} USDT to ${WALLET_2}`);
      await (await usdt.transfer(WALLET_2, ethers.parseUnits(amount2.toString(), 18))).wait();

      console.log("✅ Split complete!");
    } else {
      console.log(`⚠️ Amount ${amount} USDT is below minimum ${MIN_AMOUNT} USDT — skipping.`);
    }
  } catch (err) {
    console.error("❌ Error in split:", err);
  }
});
