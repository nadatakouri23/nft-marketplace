// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title NFTMarketplace : vente à prix fixe (en ETH) des NFT d'une collection ERC-721
/// @dev Le NFT reste chez le vendeur (non-custodial) : il doit seulement approuver ce contrat.
contract NFTMarketplace is ReentrancyGuard {
    struct Listing {
        address seller; // address(0) => pas d'annonce active
        uint256 price;  // en wei
    }

    IERC721Enumerable public immutable nft;

    /// tokenId => annonce active
    mapping(uint256 => Listing) public listings;

    event NFTListed(uint256 indexed tokenId, address indexed seller, uint256 price);
    event NFTSold(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 price);
    event ListingCancelled(uint256 indexed tokenId, address indexed seller);

    constructor(address nftAddress) {
        require(nftAddress != address(0), "Adresse NFT invalide");
        nft = IERC721Enumerable(nftAddress);
    }

    /// @notice Met un NFT en vente. L'appelant doit en être propriétaire et avoir approuvé ce contrat.
    function listNFT(uint256 tokenId, uint256 price) external {
        require(price > 0, "Prix doit etre > 0");
        require(nft.ownerOf(tokenId) == msg.sender, "Vous n'etes pas proprietaire");
        require(
            nft.getApproved(tokenId) == address(this) || nft.isApprovedForAll(msg.sender, address(this)),
            "Marketplace non approuvee"
        );
        require(listings[tokenId].seller == address(0), "Deja en vente");

        listings[tokenId] = Listing(msg.sender, price);
        emit NFTListed(tokenId, msg.sender, price);
    }

    /// @notice Achète un NFT en vente. Tout est atomique : si une étape échoue, tout est annulé.
    function buyNFT(uint256 tokenId) external payable nonReentrant {
        Listing memory item = listings[tokenId];
        require(item.seller != address(0), "NFT non en vente");
        require(msg.value == item.price, "Prix incorrect");
        require(msg.sender != item.seller, "Vendeur ne peut pas acheter");

        // 1. Effets : on supprime l'annonce AVANT tout appel externe (anti double vente / réentrance)
        delete listings[tokenId];

        // 2. Interactions : transfert du NFT (revert si le vendeur n'est plus propriétaire ou a retiré l'approbation)
        nft.safeTransferFrom(item.seller, msg.sender, tokenId);

        // 3. Paiement du vendeur (revert si échec => le transfert du NFT est annulé aussi)
        (bool ok, ) = payable(item.seller).call{value: msg.value}("");
        require(ok, "Paiement echoue");

        emit NFTSold(tokenId, item.seller, msg.sender, item.price);
    }

    /// @notice Annule une annonce. Réservé au vendeur.
    function cancelListing(uint256 tokenId) external {
        require(listings[tokenId].seller == msg.sender, "Vous n'etes pas le vendeur");
        delete listings[tokenId];
        emit ListingCancelled(tokenId, msg.sender);
    }

    /// @notice Liste les annonces actives et encore valides (utile au frontend).
    function getActiveListings()
        external view
        returns (uint256[] memory tokenIds, address[] memory sellers, uint256[] memory prices)
    {
        uint256 total = nft.totalSupply();
        uint256 count;
        for (uint256 i = 0; i < total; i++) {
            if (_isValid(nft.tokenByIndex(i))) count++;
        }
        tokenIds = new uint256[](count);
        sellers = new address[](count);
        prices = new uint256[](count);
        uint256 k;
        for (uint256 i = 0; i < total; i++) {
            uint256 id = nft.tokenByIndex(i);
            if (_isValid(id)) {
                tokenIds[k] = id;
                sellers[k] = listings[id].seller;
                prices[k] = listings[id].price;
                k++;
            }
        }
    }

    /// @dev Une annonce est valide si le vendeur possède toujours le NFT et l'approbation existe encore.
    function _isValid(uint256 tokenId) private view returns (bool) {
        Listing memory l = listings[tokenId];
        return l.seller != address(0)
            && nft.ownerOf(tokenId) == l.seller
            && (nft.getApproved(tokenId) == address(this) || nft.isApprovedForAll(l.seller, address(this)));
    }
}
