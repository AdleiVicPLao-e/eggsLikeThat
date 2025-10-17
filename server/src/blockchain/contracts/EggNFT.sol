// contracts/EggNFT.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract EggNFT is ERC1155, Ownable {
    using Strings for uint256;
    
    // Egg Types
    uint256 public constant BASIC_EGG = 1;
    uint256 public constant COSMETIC_EGG = 2;
    uint256 public constant ATTRIBUTE_EGG = 3;
    
    string public baseURI;
    mapping(uint256 => string) private _tokenURIs;
    
    event EggMinted(address indexed to, uint256 eggType, uint256 amount);
    event EggBurned(address indexed from, uint256 eggType, uint256 amount);
    
    constructor(string memory _baseURI) ERC1155(_baseURI) {
        baseURI = _baseURI;
    }
    
    function mint(address to, uint256 eggType, uint256 amount) external onlyOwner {
        require(eggType >= BASIC_EGG && eggType <= ATTRIBUTE_EGG, "Invalid egg type");
        _mint(to, eggType, amount, "");
        emit EggMinted(to, eggType, amount);
    }
    
    function mintBatch(address to, uint256[] memory eggTypes, uint256[] memory amounts) external onlyOwner {
        _mintBatch(to, eggTypes, amounts, "");
        for (uint256 i = 0; i < eggTypes.length; i++) {
            emit EggMinted(to, eggTypes[i], amounts[i]);
        }
    }
    
    function burn(address from, uint256 eggType, uint256 amount) external {
        require(
            from == _msgSender() || isApprovedForAll(from, _msgSender()),
            "Caller is not owner nor approved"
        );
        _burn(from, eggType, amount);
        emit EggBurned(from, eggType, amount);
    }
    
    function setBaseURI(string memory _baseURI) external onlyOwner {
        baseURI = _baseURI;
    }
    
    function setTokenURI(uint256 tokenId, string memory tokenURI) external onlyOwner {
        _tokenURIs[tokenId] = tokenURI;
    }
    
    function uri(uint256 tokenId) public view override returns (string memory) {
        string memory tokenURI = _tokenURIs[tokenId];
        
        // If specific URI is set, use it
        if (bytes(tokenURI).length > 0) {
            return tokenURI;
        }
        
        // Otherwise use baseURI + tokenId
        return string(abi.encodePacked(baseURI, tokenId.toString()));
    }
    
    function getEggTypeName(uint256 eggType) external pure returns (string memory) {
        if (eggType == BASIC_EGG) return "Basic Egg";
        if (eggType == COSMETIC_EGG) return "Cosmetic Egg";
        if (eggType == ATTRIBUTE_EGG) return "Attribute Egg";
        return "Unknown";
    }
}