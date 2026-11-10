// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./../MyNFT.sol";
import "./../NFTMarketplace.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

/// @dev CONTRAT DE TEST UNIQUEMENT : vendeur qui peut recevoir un NFT mais refuse tout paiement ETH.
///      Sert à vérifier que buyNFT annule tout (NFT compris) si le paiement échoue.
contract RejectingSeller is IERC721Receiver {
    function mintAndList(MyNFT nft, NFTMarketplace market, string calldata uri, uint256 price)
        external returns (uint256 tokenId)
    {
        tokenId = nft.mint(uri);
        nft.approve(address(market), tokenId);
        market.listNFT(tokenId, price);
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
    // Pas de receive()/fallback payable : tout envoi d'ETH est refusé.
}
