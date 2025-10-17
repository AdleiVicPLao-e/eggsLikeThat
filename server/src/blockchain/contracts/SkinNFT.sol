// contracts/SkinNFT.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract SkinNFT is ERC1155, Ownable {
    using Strings for uint256;
    
    // Skin Rarities as token IDs
    uint256 public constant MYTHIC_SKIN = 1;
    uint256 public constant LEGENDARY_SKIN = 2;
    uint256 public constant EPIC_SKIN = 3;
    uint256 public constant CLASSIC_SKIN = 4;
    
    string public baseURI;
    mapping(uint256 => string) private _tokenURIs;
    mapping(uint256 => string) private _skinNames;
    
    event SkinMinted(address indexed to, uint256 skinType, uint256 amount, string skinName);
    event SkinApplied(address indexed user, uint256 petTokenId, uint256 skinType);
    
    constructor(string memory _baseURI) ERC1155(_baseURI) {
        baseURI = _baseURI;
        
        // Initialize skin names
        _skinNames[MYTHIC_SKIN] = "Mythic Skin";
        _skinNames[LEGENDARY_SKIN] = "Legendary Skin";
        _skinNames[EPIC_SKIN] = "Epic Skin";
        _skinNames[CLASSIC_SKIN] = "Classic Skin";
    }
    
    function mint(address to, uint256 skinType, uint256 amount, string memory skinName) external onlyOwner {
        require(skinType >= MYTHIC_SKIN && skinType <= CLASSIC_SKIN, "Invalid skin type");
        _mint(to, skinType, amount, "");
        _skinNames[skinType] = skinName;
        emit SkinMinted(to, skinType, amount, skinName);
    }
    
    function mintBatch(
        address to, 
        uint256[] memory skinTypes, 
        uint256[] memory amounts, 
        string[] memory skinNames
    ) external onlyOwner {
        require(skinTypes.length == skinNames.length, "Arrays length mismatch");
        
        _mintBatch(to, skinTypes, amounts, "");
        
        for (uint256 i = 0; i < skinTypes.length; i++) {
            _skinNames[skinTypes[i]] = skinNames[i];
            emit SkinMinted(to, skinTypes[i], amounts[i], skinNames[i]);
        }
    }
    
    function setBaseURI(string memory _baseURI) external onlyOwner {
        baseURI = _baseURI;
    }
    
    function setTokenURI(uint256 tokenId, string memory tokenURI) external onlyOwner {
        _tokenURIs[tokenId] = tokenURI;
    }
    
    function setSkinName(uint256 skinType, string memory skinName) external onlyOwner {
        _skinNames[skinType] = skinName;
    }
    
    function uri(uint256 tokenId) public view override returns (string memory) {
        string memory tokenURI = _tokenURIs[tokenId];
        
        if (bytes(tokenURI).length > 0) {
            return tokenURI;
        }
        
        return string(abi.encodePacked(baseURI, tokenId.toString()));
    }
    
    function getSkinName(uint256 skinType) external view returns (string memory) {
        return _skinNames[skinType];
    }
    
    function getSkinRarity(uint256 skinType) external pure returns (string memory) {
        if (skinType == MYTHIC_SKIN) return "Mythic";
        if (skinType == LEGENDARY_SKIN) return "Legendary";
        if (skinType == EPIC_SKIN) return "Epic";
        if (skinType == CLASSIC_SKIN) return "Classic";
        return "Unknown";
    }
}