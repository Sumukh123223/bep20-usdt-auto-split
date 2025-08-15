import { ethers } from "ethers";

// ====== CONFIG (from env) ======
const RPC_URL   = process.env.RPC_URL   || "https://bsc-dataseed.binance.org/";
const USDT_ADDR = process.env.USDT_ADDR || "0x55d398326f99059fF775485246999027B3197955"; // BEP-20 USDT
const MY_WALLET = process.env.MY_WALLET;     // your listener wallet (same as the private key wallet)
const PRIV_KEY  = process.env.PRIVATE_KEY;   // NEVER commit this
const WALLET_1  = process.env.WALLET_1;      // split dest 1
const WALLET_2  = process.env.WALLET_2;      // split dest 2
const RATIO_1   = Number(process.env.RATIO_1 || "70"); // percent to WALLET_1
const RATIO_2   = Number(process.env.RATIO_2 || "30"); // percent to WALLET_2
const MIN_AMOUNT= Number(process.env.MIN_AMOUNT || "1"); // min USDT to trigger split

// ---- minimal sanity to avoid crashing on undefined MY_WALLET (no BNB checks) ----
if (!PRIV_KEY || !MY_WALLET || !WALLET_1 || !WALLET_2) {
  console.error("❌ Missing one of: PRIVATE_KEY, MY_WALLET, WALLET_1, WALLET_2");
  process.exit(1);
}
if (RATIO_1 + RATIO_2 !== 100) {
  console.error("❌ RATIO_1 + RATIO_2 must equal 100");
  process.exit(1);
}

// ====== ERC20 minimal ABI ======
const ERC20_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "function transfer(address to, uint256 amount) returns (bool)"
];

// ====== Setup ======
const provider = new ethers.JsonRpcProvider(RPC_URL);
const signer   = new ethers.Wallet(PRIV_KEY, provider);
const usdt     = new ethers.Contract(USDT_ADDR, ERC20_ABI, signer);

// Log startup
console.log(`✅ Auto-Split BEP-20 USDT bot started: ${RATIO_1}% / ${RATIO_2}%`);
console.log(`📢 Listening for incoming transfers to ${MY_WALLET}...`);

// Subscribe to USDT Transfer(to == MY_WALLET)
const transferTopic = ethers.id("Transfer(address,address,uint256)");
const myWalletTopic = ethers.zeroPadValue(MY_WALLET, 32); // indexed 'to'

provider.on(
  {
    address: USDT_ADDR,
    topics: [transferTopic, null, myWalletTopic],
  },
  async (log) => {
    try {
      // Parse the log
      const iface = new ethers.Interface(ERC20_ABI);
      const parsed = iface.parseLog(log); // { name: 'Transfer', args: [from, to, value] }
      const raw = parsed.args.value;      // BigInt
      const amount = Number(ethers.formatUnits(raw, 18)); // USDT on BSC uses 18 decimals

      console.log(`💰 Received ${amount} USDT`);

      if (amount < MIN_AMOUNT) {
        console.log(`⚠️ Below minimum (${MIN_AMOUNT} USDT) — skip.`);
        return;
      }

      // Compute split (BigInt arithmetic)
      const part1 = (raw * BigInt(RATIO_1)) / BigInt(100);
      const part2 = raw - part1;

      // Try sending USDT only (no BNB checks; if gas is zero, tx will fail)
      console.log(`➡️ Sending ${ethers.formatUnits(part1, 18)} USDT to ${WALLET_1}`);
      await usdt.transfer(WALLET_1, part1).then(tx => tx.wait()).catch(err => {
        console.error("❌ Transfer 1 failed (likely no BNB for gas):", err?.shortMessage || err?.message || err);
      });

      console.log(`➡️ Sending ${ethers.formatUnits(part2, 18)} USDT to ${WALLET_2}`);
      await usdt.transfer(WALLET_2, part2).then(tx => tx.wait()).catch(err =>
        console.error("❌ Transfer 2 failed (likely no BNB for gas):", err?.shortMessage || err?.message || err)
      );

      console.log("✅ Attempted split complete.");
    } catch (err) {
      console.error("❌ Handler error:", err?.shortMessage || err?.message || err);
    }
  }
);
