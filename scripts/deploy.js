const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const OUT_DIR = path.join(__dirname, "..", "frontend", "src", "contracts");

async function main() {
  const { ethers, network, artifacts } = hre;
  const [deployer] = await ethers.getSigners();
  const chainId = Number((await ethers.provider.getNetwork()).chainId);

  console.log(`Réseau : ${network.name} (chainId ${chainId})`);
  console.log(`Déployeur : ${deployer.address}`);

  const nft = await (await ethers.getContractFactory("MyNFT")).deploy();
  await nft.waitForDeployment();
  const nftAddress = await nft.getAddress();
  console.log("MyNFT           :", nftAddress);

  const market = await (await ethers.getContractFactory("NFTMarketplace")).deploy(nftAddress);
  await market.waitForDeployment();
  const marketAddress = await market.getAddress();
  console.log("NFTMarketplace  :", marketAddress);

  // --- Export pour le frontend ---
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Adresses : on conserve celles des autres réseaux déjà déployés
  const addrFile = path.join(OUT_DIR, "deployments.json");
  const deployments = fs.existsSync(addrFile) ? JSON.parse(fs.readFileSync(addrFile, "utf8")) : {};
  deployments[chainId] = { network: network.name, MyNFT: nftAddress, NFTMarketplace: marketAddress };
  fs.writeFileSync(addrFile, JSON.stringify(deployments, null, 2));

  // ABI
  for (const name of ["MyNFT", "NFTMarketplace"]) {
    const { abi } = await artifacts.readArtifact(name);
    fs.writeFileSync(path.join(OUT_DIR, `${name}.json`), JSON.stringify(abi, null, 2));
  }
  console.log(`Adresses et ABI écrits dans ${path.relative(process.cwd(), OUT_DIR)}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
