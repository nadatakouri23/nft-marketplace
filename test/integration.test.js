// Test d'intégration : rejoue le parcours utilisateur complet.
// Les contrats sont instanciés avec les ABI EXPORTÉES pour le frontend (frontend/src/contracts/*.json),
// exactement comme le fait l'application : si les ABI sont périmées, ce test échoue.
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { pathToFileURL } = require("url");
const path = require("path");

const nftAbi = require("../frontend/src/contracts/MyNFT.json");
const marketAbi = require("../frontend/src/contracts/NFTMarketplace.json");

describe("Intégration : parcours utilisateur complet", () => {
  let nft, market, marketAddr, sara, paul, tom;
  const PRICE = ethers.parseEther("0.5");
  const URI = "ipfs://bafy-integration-test";

  beforeEach(async () => {
    [, sara, paul, tom] = await ethers.getSigners();
    const nftDeployed = await (await ethers.getContractFactory("MyNFT")).deploy();
    const marketDeployed = await (await ethers.getContractFactory("NFTMarketplace")).deploy(await nftDeployed.getAddress());
    marketAddr = await marketDeployed.getAddress();
    // Contrats "vus par le frontend" : ABI exportée + adresse
    nft = new ethers.Contract(await nftDeployed.getAddress(), nftAbi, ethers.provider);
    market = new ethers.Contract(marketAddr, marketAbi, ethers.provider);
  });

  it("créer -> approuver -> vendre -> acheter -> historique", async () => {
    // 1. Sara crée un NFT
    await nft.connect(sara).mint(URI);
    expect(await nft.ownerOf(1)).to.equal(sara.address);
    expect(await nft.tokenURI(1)).to.equal(URI);

    // 2. Elle approuve la marketplace puis met en vente
    await nft.connect(sara).approve(marketAddr, 1);
    await market.connect(sara).listNFT(1, PRICE);

    // 3. La page Explorer voit l'annonce
    let [ids, sellers, prices] = await market.getActiveListings();
    expect(ids.map(Number)).to.deep.equal([1]);
    expect(sellers[0]).to.equal(sara.address);
    expect(prices[0]).to.equal(PRICE);

    // 4. Paul achète : l'ETH va à Sara, le NFT à Paul
    const buy = market.connect(paul).buyNFT(1, { value: PRICE });
    await expect(buy).to.changeEtherBalances([paul, sara], [-PRICE, PRICE]);
    expect(await nft.ownerOf(1)).to.equal(paul.address);

    // 5. Plus d'annonce active ; "Mes NFT" de chacun est à jour
    [ids] = await market.getActiveListings();
    expect(ids.length).to.equal(0);
    expect(await nft.balanceOf(sara.address)).to.equal(0);
    expect(await nft.tokenOfOwnerByIndex(paul.address, 0)).to.equal(1);

    // 6. Historique (mêmes requêtes que la page Mes NFT)
    expect((await nft.queryFilter(nft.filters.NFTMinted(null, sara.address))).length).to.equal(1);
    expect((await market.queryFilter(market.filters.NFTListed(null, sara.address))).length).to.equal(1);
    expect((await market.queryFilter(market.filters.NFTSold(null, sara.address, null))).length).to.equal(1); // vente de Sara
    expect((await market.queryFilter(market.filters.NFTSold(null, null, paul.address))).length).to.equal(1); // achat de Paul
  });

  it("revente : l'acheteur peut remettre le NFT en vente", async () => {
    await nft.connect(sara).mint(URI);
    await nft.connect(sara).approve(marketAddr, 1);
    await market.connect(sara).listNFT(1, PRICE);
    await market.connect(paul).buyNFT(1, { value: PRICE });

    await nft.connect(paul).approve(marketAddr, 1);
    await market.connect(paul).listNFT(1, PRICE * 2n);
    await market.connect(tom).buyNFT(1, { value: PRICE * 2n });
    expect(await nft.ownerOf(1)).to.equal(tom.address);
  });

  it("annulation : l'annonce disparaît d'Explorer et ne peut plus être achetée", async () => {
    await nft.connect(sara).mint(URI);
    await nft.connect(sara).setApprovalForAll(marketAddr, true);
    await market.connect(sara).listNFT(1, PRICE);
    await market.connect(sara).cancelListing(1);

    const [ids] = await market.getActiveListings();
    expect(ids.length).to.equal(0);
    await expect(market.connect(paul).buyNFT(1, { value: PRICE })).to.be.revertedWith("NFT non en vente");
    expect(await nft.ownerOf(1)).to.equal(sara.address);
  });

  it("concurrence : deux acheteurs, un seul gagne, l'autre ne perd rien", async () => {
    await nft.connect(sara).mint(URI);
    await nft.connect(sara).approve(marketAddr, 1);
    await market.connect(sara).listNFT(1, PRICE);

    await market.connect(paul).buyNFT(1, { value: PRICE });
    const before = await ethers.provider.getBalance(tom.address);
    await expect(market.connect(tom).buyNFT(1, { value: PRICE })).to.be.revertedWith("NFT non en vente");
    // Une transaction qui échoue coûte du gas, mais le PRIX n'est jamais débité.
    const lost = before - (await ethers.provider.getBalance(tom.address));
    expect(lost).to.be.lt(PRICE / 100n);
    expect(await ethers.provider.getBalance(marketAddr)).to.equal(0); // la marketplace ne garde rien
    expect(await nft.ownerOf(1)).to.equal(paul.address);
  });

  it("plusieurs NFT : Explorer ne liste que les annonces valides", async () => {
    for (let i = 0; i < 3; i++) await nft.connect(sara).mint(URI);
    await nft.connect(sara).setApprovalForAll(marketAddr, true);
    for (let id = 1; id <= 3; id++) await market.connect(sara).listNFT(id, PRICE);

    await nft.connect(sara).transferFrom(sara.address, tom.address, 2); // annonce #2 devient invalide
    const [ids] = await market.getActiveListings();
    expect(ids.map(Number)).to.deep.equal([1, 3]);
  });
});

// Tests des fonctions de validation du frontend (module ESM importé depuis CommonJS)
describe("Frontend : validations et messages d'erreur", () => {
  let validatePrice, errorMessage, shortAddress;

  before(async () => {
    const file = path.join(__dirname, "..", "frontend", "src", "utils", "format.js");
    ({ validatePrice, errorMessage, shortAddress } = await import(pathToFileURL(file).href));
  });

  it("validatePrice accepte les prix valides", () => {
    for (const v of ["1", "0.05", "10.123456789012345678", " 2 "]) expect(validatePrice(v), v).to.equal("");
  });

  it("validatePrice refuse les prix invalides", () => {
    for (const v of ["", "   ", "0", "0.0", "-1", "abc", "1,5", "1e3", "1.1234567890123456789"])
      expect(validatePrice(v), `"${v}"`).to.not.equal("");
  });

  it("errorMessage traduit un refus MetaMask", () => {
    expect(errorMessage({ code: "ACTION_REJECTED" })).to.match(/refusée/);
    expect(errorMessage({ code: 4001 })).to.match(/refusée/);
  });

  it("errorMessage traduit un solde insuffisant", () => {
    expect(errorMessage({ code: "INSUFFICIENT_FUNDS" })).to.match(/Solde insuffisant/);
  });

  it("errorMessage extrait la raison d'un revert et gère l'inconnu", () => {
    expect(errorMessage({ reason: "Prix incorrect" })).to.equal("Prix incorrect");
    expect(errorMessage({})).to.equal("Erreur inconnue.");
  });

  it("shortAddress raccourcit une adresse", () => {
    expect(shortAddress("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266")).to.equal("0xf39F…2266");
    expect(shortAddress(null)).to.equal("");
  });
});
