// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";

/// @title MyNFT : collection ERC-721 avec URI de métadonnées (IPFS) par token
/// @notice Mint ouvert à tous. Le propriétaire est celui qui appelle mint().
contract MyNFT is ERC721URIStorage, ERC721Enumerable {
    uint256 private _nextTokenId = 1; // les ids commencent à 1

    event NFTMinted(uint256 indexed tokenId, address indexed creator, string tokenURI);

    constructor() ERC721("MyNFT", "MNFT") {}

    /// @param uri URI des métadonnées, ex. ipfs://<CID>
    function mint(string calldata uri) external returns (uint256 tokenId) {
        require(bytes(uri).length > 0, "URI vide");
        tokenId = _nextTokenId++;
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, uri);
        emit NFTMinted(tokenId, msg.sender, uri);
    }

    // --- Résolution des conflits d'héritage (exigée par Solidity) ---

    function _update(address to, uint256 tokenId, address auth)
        internal override(ERC721, ERC721Enumerable) returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value)
        internal override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }

    function tokenURI(uint256 tokenId)
        public view override(ERC721, ERC721URIStorage) returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721URIStorage, ERC721Enumerable) returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
