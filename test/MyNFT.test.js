const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MyNFT", () => {
  let nft, alice, bob;
  const URI = "ipfs://bafy-test-cid";

  beforeEach(async () => {
    [alice, bob] = await ethers.getSigners();
    nft = await (await ethers.getContractFactory("MyNFT")).deploy();
  });

  it("mint : attribue le NFT à l'appelant avec son URI", async () => {
    await nft.connect(alice).mint(URI);
    expect(await nft.ownerOf(1)).to.equal(alice.address);
    expect(await nft.tokenURI(1)).to.equal(URI);
    expect(await nft.totalSupply()).to.equal(1);
  });

  it("mint : émet l'événement NFTMinted", async () => {
    await expect(nft.connect(alice).mint(URI))
      .to.emit(nft, "NFTMinted")
      .withArgs(1, alice.address, URI);
  });

  it("mint : les ids sont incrémentaux et uniques", async () => {
    await nft.connect(alice).mint(URI);
    await nft.connect(bob).mint(URI);
    expect(await nft.ownerOf(1)).to.equal(alice.address);
    expect(await nft.ownerOf(2)).to.equal(bob.address);
  });

  it("mint : refuse une URI vide", async () => {
    await expect(nft.mint("")).to.be.revertedWith("URI vide");
  });

  it("transfert : le propriétaire peut transférer", async () => {
    await nft.connect(alice).mint(URI);
    await nft.connect(alice).transferFrom(alice.address, bob.address, 1);
    expect(await nft.ownerOf(1)).to.equal(bob.address);
  });

  it("transfert : un non-propriétaire ne peut pas transférer", async () => {
    await nft.connect(alice).mint(URI);
    await expect(
      nft.connect(bob).transferFrom(alice.address, bob.address, 1)
    ).to.be.revertedWithCustomError(nft, "ERC721InsufficientApproval");
  });

  it("énumération : tokenOfOwnerByIndex liste les NFT d'un utilisateur", async () => {
    await nft.connect(alice).mint(URI);
    await nft.connect(alice).mint(URI);
    expect(await nft.balanceOf(alice.address)).to.equal(2);
    expect(await nft.tokenOfOwnerByIndex(alice.address, 1)).to.equal(2);
  });
});
