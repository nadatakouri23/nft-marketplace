// Mesures de performance des opérations blockchain.
//   Hardhat (en mémoire) : npx hardhat run scripts/benchmark.js
//   Nœud local           : npx hardhat run scripts/benchmark.js --network localhost
//   Sepolia              : npx hardhat run scripts/benchmark.js --network sepolia
// Variables optionnelles : BENCH_RUNS (défaut 10), BENCH_BATCH (défaut 20), BENCH_FUND (ETH, défaut 0.02)
//
// Définitions :
//   envoi        = temps pour que le nœud ACCEPTE la transaction et renvoie son hash (await contract.fn())
//   confirmation = temps ensuite jusqu'à l'inclusion dans un bloc (await tx.wait())
//   total        = envoi + confirmation
//   frais        = gasUsed x effectiveGasPrice
const fs = require("fs");
const path = require("path");
const { performance } = require("perf_hooks");
const hre = require("hardhat");

const RUNS = Number(process.env.BENCH_RUNS || 10);
const BATCH = Number(process.env.BENCH_BATCH || 20);
const FUND = process.env.BENCH_FUND || "0.02";

const { ethers, network } = hre;
const PRICE = ethers.parseEther("0.0001");
const URI = "ipfs://bafy-benchmark";
const results = {}; // opération -> liste de mesures

async function timed(op, fn) {
  const t0 = performance.now();
  const tx = await fn();
  const t1 = performance.now();
  const receipt = await tx.wait();
  const t2 = performance.now();
  (results[op] ??= []).push({
    sendMs: t1 - t0,
    confirmMs: t2 - t1,
    totalMs: t2 - t0,
    gasUsed: Number(receipt.gasUsed),
    feeWei: receipt.gasUsed * receipt.gasPrice, // gasPrice = effectiveGasPrice en ethers v6
    gasPriceGwei: Number(ethers.formatUnits(receipt.gasPrice, "gwei")),
  });
  return receipt;
}

const sum = (a) => a.reduce((x, y) => x + y, 0);
const mean = (a) => sum(a) / a.length;
const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const stats = (a) => ({ mean: mean(a), median: median(a), min: Math.min(...a), max: Math.max(...a) });

async function main() {
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  const signers = await ethers.getSigners();
  const seller = signers[0];
  let buyer = signers[1];
  let temporaryBuyer = false;

  if (!buyer) {
    // Réseau avec un seul compte (ex. Sepolia) : portefeuille jetable financé par le vendeur
    buyer = ethers.Wallet.createRandom().connect(ethers.provider);
    temporaryBuyer = true;
    console.log(`Un seul compte configuré : acheteur temporaire ${buyer.address} financé de ${FUND} ETH.`);
    await (await seller.sendTransaction({ to: buyer.address, value: ethers.parseEther(FUND) })).wait();
  }

  console.log(`Réseau : ${network.name} (chainId ${chainId}) | ${RUNS} répétitions, lot de ${BATCH}`);

  const nft = await (await ethers.getContractFactory("MyNFT")).deploy();
  await nft.waitForDeployment();
  const market = await (await ethers.getContractFactory("NFTMarketplace")).deploy(await nft.getAddress());
  await market.waitForDeployment();
  const marketAddr = await market.getAddress();

  // --- Latences et gas : un cycle complet par répétition ---
  let nextId = 1;
  for (let i = 0; i < RUNS; i++) {
    // Token A : mint -> approve -> list -> buy
    const a = nextId++;
    await timed("mint", () => nft.connect(seller).mint(URI));
    await timed("approve", () => nft.connect(seller).approve(marketAddr, a));
    await timed("list", () => market.connect(seller).listNFT(a, PRICE));
    await timed("buy", () => market.connect(buyer).buyNFT(a, { value: PRICE }));
    // Token B : mint -> approve -> list -> cancel
    const b = nextId++;
    await timed("mint", () => nft.connect(seller).mint(URI));
    await timed("approve", () => nft.connect(seller).approve(marketAddr, b));
    await timed("list", () => market.connect(seller).listNFT(b, PRICE));
    await timed("cancel", () => market.connect(seller).cancelListing(b));
    process.stdout.write(`  répétition ${i + 1}/${RUNS}\r`);
  }
  console.log();

  // --- Débit ---
  // Séquentiel : on attend chaque confirmation avant d'envoyer la suivante
  let t0 = performance.now();
  for (let i = 0; i < BATCH; i++) await (await nft.connect(seller).mint(URI)).wait();
  const seqSeconds = (performance.now() - t0) / 1000;

  // Parallèle : on envoie tout (nonces explicites) puis on attend toutes les confirmations
  const baseNonce = await ethers.provider.getTransactionCount(seller.address, "pending");
  t0 = performance.now();
  const txs = [];
  // Envoi dans l'ordre des nonces, SANS attendre les confirmations (elles sont attendues ensuite en bloc)
  for (let i = 0; i < BATCH; i++) txs.push(await nft.connect(seller).mint(URI, { nonce: baseNonce + i }));
  await Promise.all(txs.map((t) => t.wait()));
  const parSeconds = (performance.now() - t0) / 1000;

  // --- Agrégation ---
  const ops = {};
  for (const [op, rows] of Object.entries(results)) {
    const feeMeanWei = mean(rows.map((r) => Number(r.feeWei)));
    ops[op] = {
      count: rows.length,
      send: stats(rows.map((r) => r.sendMs)),
      confirm: stats(rows.map((r) => r.confirmMs)),
      total: stats(rows.map((r) => r.totalMs)),
      gasUsed: mean(rows.map((r) => r.gasUsed)),
      gasPriceGwei: mean(rows.map((r) => r.gasPriceGwei)),
      feeEth: feeMeanWei / 1e18,
    };
  }
  const output = {
    network: network.name,
    chainId,
    date: new Date().toISOString(),
    runs: RUNS,
    batch: BATCH,
    ops,
    throughput: {
      sequentialTps: BATCH / seqSeconds,
      parallelTps: BATCH / parSeconds,
      sequentialSeconds: seqSeconds,
      parallelSeconds: parSeconds,
    },
  };

  // --- Sauvegarde : un fichier par réseau + un fichier consolidé pour le frontend ---
  const root = path.join(__dirname, "..");
  fs.mkdirSync(path.join(root, "benchmarks"), { recursive: true });
  fs.writeFileSync(path.join(root, "benchmarks", `results-${network.name}.json`), JSON.stringify(output, null, 2));

  const dataDir = path.join(root, "frontend", "src", "data");
  fs.mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, "benchmarks.json");
  const all = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
  all[network.name] = output;
  fs.writeFileSync(file, JSON.stringify(all, null, 2));

  // --- Affichage ---
  const f = (n) => n.toFixed(1).padStart(8);
  console.log("\nOpération | envoi ms | confirm. ms | total ms |   gas   | frais ETH");
  for (const [op, o] of Object.entries(ops))
    console.log(`${op.padEnd(9)} | ${f(o.send.mean)} | ${f(o.confirm.mean)}    | ${f(o.total.mean)} | ${String(Math.round(o.gasUsed)).padStart(7)} | ${o.feeEth.toFixed(8)}`);
  console.log(`\nDébit séquentiel : ${output.throughput.sequentialTps.toFixed(2)} tx/s | parallèle : ${output.throughput.parallelTps.toFixed(2)} tx/s`);
  console.log(`Résultats écrits dans benchmarks/ et frontend/src/data/benchmarks.json`);

  // Récupère les fonds restants de l'acheteur temporaire (meilleur effort)
  if (temporaryBuyer) {
    try {
      const fee = await ethers.provider.getFeeData();
      const cost = 21000n * (fee.maxFeePerGas ?? fee.gasPrice) * 2n;
      const bal = await ethers.provider.getBalance(buyer.address);
      if (bal > cost) await (await buyer.sendTransaction({ to: seller.address, value: bal - cost })).wait();
    } catch {
      console.log(`Note : fonds restants sur ${buyer.address} (portefeuille jetable).`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
