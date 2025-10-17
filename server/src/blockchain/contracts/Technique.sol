// contracts/TechniqueNFT.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract TechniqueNFT is ERC1155, Ownable {
    using Strings for uint256;
    
    struct TechniqueInfo {
        string name;
        string effect;
        uint256 level;
        string rarity;
    }
    
    string public baseURI;
    mapping(uint256 => TechniqueInfo) public techniqueInfo;
    mapping(uint256 => string) private _tokenURIs;
    uint256 private _nextTokenId = 1;
    
    event TechniqueMinted(address indexed to, uint256 tokenId, TechniqueInfo info);
    event TechniqueApplied(address indexed user, uint256 petTokenId, uint256 techniqueTokenId);
    
    constructor(string memory _baseURI) ERC1155(_baseURI) {
        baseURI = _baseURI;
    }
    
    function mint(
        address to,
        string memory name,
        string memory effect,
        uint256 level,
        string memory rarity
    ) external onlyOwner returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        
        techniqueInfo[tokenId] = TechniqueInfo({
            name: name,
            effect: effect,
            level: level,
            rarity: rarity
        });
        
        _mint(to, tokenId, 1, "");
        
        emit TechniqueMinted(to, tokenId, techniqueInfo[tokenId]);
        
        return tokenId;
    }
    
    function mintBatch(
        address to,
        string[] memory names,
        string[] memory effects,
        uint256[] memory levels,
        string[] memory rarities
    ) external onlyOwner returns (uint256[] memory) {
        require(
            names.length == effects.length && 
            effects.length == levels.length && 
            levels.length == rarities.length,
            "Arrays length mismatch"
        );
        
        uint256[] memory tokenIds = new uint256[](names.length);
        uint256[] memory amounts = new uint256[](names.length);
        
        for (uint256 i = 0; i < names.length; i++) {
            uint256 tokenId = _nextTokenId++;
            
            techniqueInfo[tokenId] = TechniqueInfo({
                name: names[i],
                effect: effects[i],
                level: levels[i],
                rarity: rarities[i]
            });
            
            tokenIds[i] = tokenId;
            amounts[i] = 1;
            
            emit TechniqueMinted(to, tokenId, techniqueInfo[tokenId]);
        }
        
        _mintBatch(to, tokenIds, amounts, "");
        
        return tokenIds;
    }
    
    function setBaseURI(string memory _baseURI) external onlyOwner {
        baseURI = _baseURI;
    }
    
    function setTokenURI(uint256 tokenId, string memory tokenURI) external onlyOwner {
        _tokenURIs[tokenId] = tokenURI;
    }
    
    function uri(uint256 tokenId) public view override returns (string memory) {
        string memory tokenURI = _tokenURIs[tokenId];
        
        if (bytes(tokenURI).length > 0) {
            return tokenURI;
        }
        
        return string(abi.encodePacked(baseURI, tokenId.toString()));
    }
    
    function getTechniqueInfo(uint256 tokenId) external view returns (TechniqueInfo memory) {
        return techniqueInfo[tokenId];
    }
    
    function getTechniqueRarity(uint256 tokenId) external view returns (string memory) {
        return techniqueInfo[tokenId].rarity;
    }
}