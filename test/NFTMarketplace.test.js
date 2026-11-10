const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("NFTMarketplace", () => {
  let nft, market, marketAddr, seller, buyer, other;
  const URI = "ipfs://bafy-test-cid";
  const PRICE = ethers.parseEther("1");

  beforeEach(async () => {
    [seller, buyer, other] = await ethers.getSigners();
    nft = await (await ethers.getContractFactory("MyNFT")).deploy();
    market = await (await ethers.getContractFactory("NFTMarketplace")).deploy(await nft.getAddress());
    marketAddr = await market.getAddress();
    await nft.connect(seller).mint(URI); // tokenId 1, au vendeur
  });

  const approveAndList = async () => {
    await nft.connect(seller).approve(marketAddr, 1);
    await market.connect(seller).listNFT(1, PRICE);
  };

  describe("listNFT", () => {
    it("crée l'annonce et émet NFTListed", async () => {
      await nft.connect(seller).approve(marketAddr, 1);
      await expect(market.connect(seller).listNFT(1, PRICE))
        .to.emit(market, "NFTListed").withArgs(1, seller.address, PRICE);
      const l = await market.listings(1);
      expect(l.seller).to.equal(seller.address);
      expect(l.price).to.equal(PRICE);
    });

    it("accepte setApprovalForAll", async () => {
      await nft.connect(seller).setApprovalForAll(marketAddr, true);
      await market.connect(seller).listNFT(1, PRICE);
    });

    it("refuse un prix de 0", async () => {
      await nft.connect(seller).approve(marketAddr, 1);
      await expect(market.connect(seller).listNFT(1, 0)).to.be.revertedWith("Prix doit etre > 0");
    });

    it("refuse si l'appelant n'est pas propriétaire", async () => {
      await nft.connect(seller).approve(marketAddr, 1);
      await expect(market.connect(buyer).listNFT(1, PRICE)).to.be.revertedWith("Vous n'etes pas proprietaire");
    });

    it("refuse si la marketplace n'est pas approuvée", async () => {
      await expect(market.connect(seller).listNFT(1, PRICE)).to.be.revertedWith("Marketplace non approuvee");
    });

    it("refuse une annonce en double", async () => {
      await approveAndList();
      await expect(market.connect(seller).listNFT(1, PRICE)).to.be.revertedWith("Deja en vente");
    });

    it("refuse un NFT inexistant", async () => {
      await expect(market.connect(seller).listNFT(99, PRICE))
        .to.be.revertedWithCustomError(nft, "ERC721NonexistentToken");
    });
  });

  describe("buyNFT", () => {
    beforeEach(approveAndList);

    it("transfère le NFT à l'acheteur et l'ETH au vendeur, émet NFTSold", async () => {
      const tx = market.connect(buyer).buyNFT(1, { value: PRICE });
      await expect(tx).to.emit(market, "NFTSold").withArgs(1, seller.address, buyer.address, PRICE);
      await expect(tx).to.changeEtherBalances([buyer, seller], [-PRICE, PRICE]);
      expect(await nft.ownerOf(1)).to.equal(buyer.address);
      expect((await market.listings(1)).seller).to.equal(ethers.ZeroAddress);
      expect(await ethers.provider.getBalance(marketAddr)).to.equal(0);
    });

    it("refuse un mauvais prix (trop bas ou trop haut)", async () => {
      await expect(market.connect(buyer).buyNFT(1, { value: PRICE - 1n })).to.be.revertedWith("Prix incorrect");
      await expect(market.connect(buyer).buyNFT(1, { value: PRICE + 1n })).to.be.revertedWith("Prix incorrect");
    });

    it("refuse un NFT non mis en vente", async () => {
      await nft.connect(seller).mint(URI); // tokenId 2, pas listé
      await expect(market.connect(buyer).buyNFT(2, { value: PRICE })).to.be.revertedWith("NFT non en vente");
    });

    it("refuse l'achat par le vendeur", async () => {
      await expect(market.connect(seller).buyNFT(1, { value: PRICE })).to.be.revertedWith("Vendeur ne peut pas acheter");
    });

    it("refuse un second achat (déjà vendu)", async () => {
      await market.connect(buyer).buyNFT(1, { value: PRICE });
      await expect(market.connect(other).buyNFT(1, { value: PRICE })).to.be.revertedWith("NFT non en vente");
    });

    it("annule tout si le vendeur a transféré le NFT entre-temps", async () => {
      await nft.connect(seller).transferFrom(seller.address, other.address, 1);
      await expect(market.connect(buyer).buyNFT(1, { value: PRICE })).to.be.reverted;
      expect(await nft.ownerOf(1)).to.equal(other.address);
    });

    it("annule tout si l'approbation a été retirée", async () => {
      await nft.connect(seller).approve(ethers.ZeroAddress, 1);
      await expect(market.connect(buyer).buyNFT(1, { value: PRICE })).to.be.reverted;
      expect(await nft.ownerOf(1)).to.equal(seller.address);
    });
  });

  describe("cancelListing", () => {
    beforeEach(approveAndList);

    it("annule l'annonce et émet ListingCancelled", async () => {
      await expect(market.connect(seller).cancelListing(1))
        .to.emit(market, "ListingCancelled").withArgs(1, seller.address);
      expect((await market.listings(1)).seller).to.equal(ethers.ZeroAddress);
    });

    it("refuse si l'appelant n'est pas le vendeur", async () => {
      await expect(market.connect(buyer).cancelListing(1)).to.be.revertedWith("Vous n'etes pas le vendeur");
    });

    it("rend l'achat impossible après annulation", async () => {
      await market.connect(seller).cancelListing(1);
      await expect(market.connect(buyer).buyNFT(1, { value: PRICE })).to.be.revertedWith("NFT non en vente");
    });

    it("permet de remettre en vente après annulation", async () => {
      await market.connect(seller).cancelListing(1);
      await market.connect(seller).listNFT(1, PRICE * 2n);
      expect((await market.listings(1)).price).to.equal(PRICE * 2n);
    });
  });

  describe("getActiveListings", () => {
    it("retourne seulement les annonces valides", async () => {
      await nft.connect(seller).mint(URI); // 2
      await nft.connect(seller).setApprovalForAll(marketAddr, true);
      await market.connect(seller).listNFT(1, PRICE);
      await market.connect(seller).listNFT(2, PRICE * 2n);

      let [ids, sellers, prices] = await market.getActiveListings();
      expect(ids.map(Number)).to.deep.equal([1, 2]);
      expect(sellers[0]).to.equal(seller.address);
      expect(prices[1]).to.equal(PRICE * 2n);

      // NFT 1 transféré hors marketplace => annonce invalide, filtrée
      await nft.connect(seller).transferFrom(seller.address, other.address, 1);
      [ids] = await market.getActiveListings();
      expect(ids.map(Number)).to.deep.equal([2]);
    });
  });

  describe("atomicité", () => {
    it("si le vendeur refuse le paiement, le NFT n'est pas transféré", async () => {
      const bad = await (await ethers.getContractFactory("RejectingSeller")).deploy();
      await bad.mintAndList(await nft.getAddress(), marketAddr, URI, PRICE); // tokenId 2
      await expect(market.connect(buyer).buyNFT(2, { value: PRICE })).to.be.revertedWith("Paiement echoue");
      expect(await nft.ownerOf(2)).to.equal(await bad.getAddress());
      expect((await market.listings(2)).seller).to.equal(await bad.getAddress()); // annonce intacte
    });
  });

  it("constructeur : refuse l'adresse zéro", async () => {
    const F = await ethers.getContractFactory("NFTMarketplace");
    await expect(F.deploy(ethers.ZeroAddress)).to.be.revertedWith("Adresse NFT invalide");
  });
});
