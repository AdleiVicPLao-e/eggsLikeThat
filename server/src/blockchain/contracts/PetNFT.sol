// contracts/PetNFT.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract PetNFT is ERC721, ERC721Enumerable, Ownable {
    using Counters for Counters.Counter;
    using Strings for uint256;
    
    Counters.Counter private _tokenIdCounter;
    
    string public baseURI;
    
    // Pet metadata stored on-chain (basic info) with full metadata off-chain
    struct PetMetadata {
        string name;
        string petType;
        string rarity;
        uint256 level;
        bool isShiny;
    }
    
    mapping(uint256 => PetMetadata) public petMetadata;
    mapping(uint256 => string) private _tokenURIs;
    
    event PetMinted(address indexed to, uint256 tokenId, PetMetadata metadata);
    event PetLevelUp(uint256 tokenId, uint256 newLevel);
    
    constructor(string memory _baseURI) ERC721("GamePets", "PET") {
        baseURI = _baseURI;
    }
    
    function mint(
        address to, 
        string memory name,
        string memory petType,
        string memory rarity,
        bool isShiny
    ) external onlyOwner returns (uint256) {
        _tokenIdCounter.increment();
        uint256 newTokenId = _tokenIdCounter.current();
        
        _mint(to, newTokenId);
        
        // Set basic metadata
        petMetadata[newTokenId] = PetMetadata({
            name: name,
            petType: petType,
            rarity: rarity,
            level: 1,
            isShiny: isShiny
        });
        
        emit PetMinted(to, newTokenId, petMetadata[newTokenId]);
        
        return newTokenId;
    }
    
    function levelUp(uint256 tokenId) external {
        require(_exists(tokenId), "Pet does not exist");
        require(ownerOf(tokenId) == msg.sender, "Not pet owner");
        
        petMetadata[tokenId].level++;
        emit PetLevelUp(tokenId, petMetadata[tokenId].level);
    }
    
    function setBaseURI(string memory _baseURI) external onlyOwner {
        baseURI = _baseURI;
    }
    
    function setTokenURI(uint256 tokenId, string memory tokenURI) external onlyOwner {
        require(_exists(tokenId), "Pet does not exist");
        _tokenURIs[tokenId] = tokenURI;
    }
    
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "ERC721Metadata: URI query for nonexistent token");
        
        string memory tokenURI = _tokenURIs[tokenId];
        if (bytes(tokenURI).length > 0) {
            return tokenURI;
        }
        
        return string(abi.encodePacked(baseURI, tokenId.toString()));
    }
    
    function getPetMetadata(uint256 tokenId) external view returns (PetMetadata memory) {
        require(_exists(tokenId), "Pet does not exist");
        return petMetadata[tokenId];
    }
    
    // Override required for ERC721Enumerable
    function _beforeTokenTransfer(address from, address to, uint256 tokenId, uint256 batchSize)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }
    
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}