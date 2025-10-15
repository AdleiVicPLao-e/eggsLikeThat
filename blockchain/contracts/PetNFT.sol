// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title PetNFT
 * @dev ERC-721 contract for PetVerse game pets with enhanced metadata
 */
contract PetNFT is ERC721, ERC721Enumerable, ERC721URIStorage, Ownable {
    using Counters for Counters.Counter;

    Counters.Counter private _tokenIdCounter;

    // Pet metadata structure
    struct PetMetadata {
        uint8 tier;        // 0: Common, 1: Uncommon, 2: Rare, 3: Epic, 4: Legendary
        uint8 petType;     // 0: Fire, 1: Water, 2: Earth, 3: Air, 4: Light, 5: Dark
        uint8 level;
        uint16 experience;
        uint16 attack;
        uint16 defense;
        uint16 speed;
        uint16 health;
        uint32 hatchDate;
        bool isFavorite;
    }

    // Mapping from token ID to pet metadata
    mapping(uint256 => PetMetadata) public petMetadata;

    // Events
    event PetMinted(
        uint256 indexed tokenId,
        address indexed owner,
        uint8 tier,
        uint8 petType,
        uint16 attack,
        uint16 defense,
        uint16 speed,
        uint16 health
    );

    event PetLevelUp(
        uint256 indexed tokenId,
        uint8 newLevel,
        uint16 newAttack,
        uint16 newDefense,
        uint16 newSpeed,
        uint16 newHealth
    );

    event PetExperienceGained(
        uint256 indexed tokenId,
        uint16 experienceGained,
        uint16 newExperience
    );

    // Constructor
    constructor() ERC721("PetVerse Pets", "PET") {}

    /**
     * @dev Mint a new pet NFT
     */
    function mintPet(
        address to,
        string memory tokenURI,
        uint8 tier,
        uint8 petType,
        uint16 attack,
        uint16 defense,
        uint16 speed,
        uint16 health
    ) external onlyOwner returns (uint256) {
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();

        _safeMint(to, tokenId);
        _setTokenURI(tokenId, tokenURI);

        // Set pet metadata
        petMetadata[tokenId] = PetMetadata({
            tier: tier,
            petType: petType,
            level: 1,
            experience: 0,
            attack: attack,
            defense: defense,
            speed: speed,
            health: health,
            hatchDate: uint32(block.timestamp),
            isFavorite: false
        });

        emit PetMinted(tokenId, to, tier, petType, attack, defense, speed, health);
        return tokenId;
    }

    /**
     * @dev Batch mint multiple pets (for initial distribution)
     */
    function batchMintPets(
        address[] memory to,
        string[] memory tokenURIs,
        uint8[] memory tiers,
        uint8[] memory petTypes,
        uint16[] memory attacks,
        uint16[] memory defenses,
        uint16[] memory speeds,
        uint16[] memory healths
    ) external onlyOwner {
        require(
            to.length == tokenURIs.length &&
            to.length == tiers.length &&
            to.length == petTypes.length &&
            to.length == attacks.length &&
            to.length == defenses.length &&
            to.length == speeds.length &&
            to.length == healths.length,
            "Arrays length mismatch"
        );

        for (uint256 i = 0; i < to.length; i++) {
            mintPet(
                to[i],
                tokenURIs[i],
                tiers[i],
                petTypes[i],
                attacks[i],
                defenses[i],
                speeds[i],
                healths[i]
            );
        }
    }

    /**
     * @dev Level up a pet (only owner can call this)
     */
    function levelUpPet(uint256 tokenId) external {
        require(_isApprovedOrOwner(_msgSender(), tokenId), "Not owner nor approved");
        
        PetMetadata storage pet = petMetadata[tokenId];
        uint8 currentLevel = pet.level;
        
        // Calculate required experience for next level
        uint16 requiredExp = uint16(currentLevel * currentLevel * 100);
        require(pet.experience >= requiredExp, "Not enough experience");

        // Level up
        pet.level = currentLevel + 1;
        pet.experience -= requiredExp;

        // Increase stats by 10%
        pet.attack = uint16(pet.attack * 110 / 100);
        pet.defense = uint16(pet.defense * 110 / 100);
        pet.speed = uint16(pet.speed * 110 / 100);
        pet.health = uint16(pet.health * 110 / 100);

        emit PetLevelUp(tokenId, pet.level, pet.attack, pet.defense, pet.speed, pet.health);
    }

    /**
     * @dev Add experience to a pet
     */
    function addExperience(uint256 tokenId, uint16 experience) external onlyOwner {
        require(_exists(tokenId), "Token does not exist");
        
        PetMetadata storage pet = petMetadata[tokenId];
        pet.experience += experience;

        emit PetExperienceGained(tokenId, experience, pet.experience);
    }

    /**
     * @dev Toggle favorite status
     */
    function toggleFavorite(uint256 tokenId) external {
        require(_isApprovedOrOwner(_msgSender(), tokenId), "Not owner nor approved");
        petMetadata[tokenId].isFavorite = !petMetadata[tokenId].isFavorite;
    }

    /**
     * @dev Get pet metadata
     */
    function getPetMetadata(uint256 tokenId) external view returns (PetMetadata memory) {
        require(_exists(tokenId), "Token does not exist");
        return petMetadata[tokenId];
    }

    /**
     * @dev Get pets owned by an address
     */
    function getPetsByOwner(address owner) external view returns (uint256[] memory) {
        uint256 tokenCount = balanceOf(owner);
        uint256[] memory tokenIds = new uint256[](tokenCount);

        for (uint256 i = 0; i < tokenCount; i++) {
            tokenIds[i] = tokenOfOwnerByIndex(owner, i);
        }

        return tokenIds;
    }

    /**
     * @dev Calculate pet power (for battles)
     */
    function calculatePower(uint256 tokenId) external view returns (uint256) {
        require(_exists(tokenId), "Token does not exist");
        PetMetadata memory pet = petMetadata[tokenId];
        
        uint256 basePower = uint256(pet.attack) + pet.defense + pet.speed + (pet.health / 10);
        uint256 tierMultiplier = (pet.tier + 1) * 20; // 20% per tier
        uint256 levelMultiplier = (pet.level * 10); // 10% per level
        
        return basePower * (100 + tierMultiplier + levelMultiplier) / 100;
    }

    // The following functions are overrides required by Solidity.

    function _beforeTokenTransfer(address from, address to, uint256 tokenId, uint256 batchSize)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }

    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
        delete petMetadata[tokenId];
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}