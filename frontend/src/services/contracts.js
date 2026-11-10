import { Contract } from "ethers";
import deployments from "../contracts/deployments.json";
import nftAbi from "../contracts/MyNFT.json";
import marketAbi from "../contracts/NFTMarketplace.json";
import { fetchMetadata } from "./ipfs.js";

/** Instancie les contrats pour le réseau courant, connectés au signataire MetaMask. */
export async function getContracts(provider, chainId) {
  const d = deployments[chainId];
  if (!d) throw new Error("Réseau non supporté : contrats non déployés ici.");
  // Le nœud local a pu être redémarré : l'adresse existe dans deployments.json mais plus sur la chaîne.
  if ((await provider.getCode(d.MyNFT)) === "0x" || (await provider.getCode(d.NFTMarketplace)) === "0x")
    throw new Error("Contrats introuvables sur ce réseau. Relance le déploiement : npx hardhat run scripts/deploy.js --network localhost");
  const signer = await provider.getSigner();
  return {
    signer,
    addresses: d,
    nft: new Contract(d.MyNFT, nftAbi, signer),
    market: new Contract(d.NFTMarketplace, marketAbi, signer),
  };
}

/** Charge un NFT (id + métadonnées). Les métadonnées illisibles n'empêchent pas l'affichage. */
export async function loadToken(nft, tokenId) {
  const uri = await nft.tokenURI(tokenId);
  try {
    const meta = await fetchMetadata(uri);
    return { tokenId, uri, ...meta };
  } catch {
    return { tokenId, uri, name: `NFT #${tokenId}`, description: "Métadonnées indisponibles.", image: "" };
  }
}

/** Tous les tokenIds appartenant à `owner`. */
export async function ownedTokenIds(nft, owner) {
  const n = Number(await nft.balanceOf(owner));
  return Promise.all(Array.from({ length: n }, (_, i) => nft.tokenOfOwnerByIndex(owner, i)));
}
