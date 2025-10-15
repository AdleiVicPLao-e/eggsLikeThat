// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title EggItem
 * @dev ERC-1155 contract for PetVerse game eggs and items
 */
contract EggItem is ERC1155, Ownable {
    using Strings for uint256;

    // Item types
    uint256 public constant EGG_BASIC = 0;
    uint256 public constant EGG_PREMIUM = 1;
    uint256 public constant EGG_COSMETIC = 2;
    uint256 public constant EGG_MYSTERY = 3;
    
    uint256 public constant ITEM_HEALING_POTION = 10;
    uint256 public constant ITEM_STAT_BOOST = 11;
    uint256 public constant ITEM_EVOLVE_STONE = 12;

    string public baseURI;
    
    // Egg metadata
    struct EggInfo {
        string name;
        uint256 price; // in wei
        uint256 maxSupply;
        uint256 minted;
        bool isActive;
    }

    mapping(uint256 => EggInfo) public eggInfo;

    // Events
    event EggMinted(address indexed to, uint256 eggType, uint256 amount);
    event EggHatched(address indexed owner, uint256 eggType, uint256 petTokenId);
    event BaseURIUpdated(string newBaseURI);

    constructor(string memory _baseURI) ERC1155(_baseURI) {
        baseURI = _baseURI;
        
        // Initialize egg types
        eggInfo[EGG_BASIC] = EggInfo("Basic Egg", 0.001 ether, 100000, 0, true);
        eggInfo[EGG_PREMIUM] = EggInfo("Premium Egg", 0.005 ether, 50000, 0, true);
        eggInfo[EGG_COSMETIC] = EggInfo("Cosmetic Egg", 0.003 ether, 25000, 0, true);
        eggInfo[EGG_MYSTERY] = EggInfo("Mystery Egg", 0.004 ether, 75000, 0, true);
    }

    /**
     * @dev Mint eggs (only owner)
     */
    function mintEgg(address to, uint256 eggType, uint256 amount) external onlyOwner {
        require(eggInfo[eggType].isActive, "Egg type not active");
        require(eggInfo[eggType].minted + amount <= eggInfo[eggType].maxSupply, "Exceeds max supply");
        
        eggInfo[eggType].minted += amount;
        _mint(to, eggType, amount, "");
        
        emit EggMinted(to, eggType, amount);
    }

    /**
     * @dev Purchase eggs with ETH
     */
    function purchaseEgg(uint256 eggType, uint256 amount) external payable {
        require(eggInfo[eggType].isActive, "Egg type not active");
        require(eggInfo[eggType].minted + amount <= eggInfo[eggType].maxSupply, "Exceeds max supply");
        require(msg.value >= eggInfo[eggType].price * amount, "Insufficient payment");

        eggInfo[eggType].minted += amount;
        _mint(msg.sender, eggType, amount, "");
        
        emit EggMinted(msg.sender, eggType, amount);
    }

    /**
     * @dev Batch purchase multiple egg types
     */
    function batchPurchaseEggs(
        uint256[] memory eggTypes,
        uint256[] memory amounts
    ) external payable {
        require(eggTypes.length == amounts.length, "Arrays length mismatch");

        uint256 totalCost = 0;
        
        for (uint256 i = 0; i < eggTypes.length; i++) {
            uint256 eggType = eggTypes[i];
            uint256 amount = amounts[i];
            
            require(eggInfo[eggType].isActive, "Egg type not active");
            require(eggInfo[eggType].minted + amount <= eggInfo[eggType].maxSupply, "Exceeds max supply");
            
            totalCost += eggInfo[eggType].price * amount;
            eggInfo[eggType].minted += amount;
            _mint(msg.sender, eggType, amount, "");
            
            emit EggMinted(msg.sender, eggType, amount);
        }

        require(msg.value >= totalCost, "Insufficient payment");
    }

    /**
     * @dev Simulate egg hatch (backend will handle actual pet creation)
     */
    function hatchEgg(uint256 eggType) external {
        require(balanceOf(msg.sender, eggType) > 0, "No eggs of this type");
        
        // Burn the egg
        _burn(msg.sender, eggType, 1);
        
        // Backend will listen to this event and mint the actual pet
        emit EggHatched(msg.sender, eggType, 0); // petTokenId will be set by backend
    }

    /**
     * @dev Get egg info
     */
    function getEggInfo(uint256 eggType) external view returns (EggInfo memory) {
        return eggInfo[eggType];
    }

    /**
     * @dev Get user's egg inventory
     */
    function getUserEggs(address user) external view returns (uint256[] memory, uint256[] memory) {
        uint256[] memory eggTypes = new uint256[](4);
        uint256[] memory balances = new uint256[](4);
        
        eggTypes[0] = EGG_BASIC;
        eggTypes[1] = EGG_PREMIUM;
        eggTypes[2] = EGG_COSMETIC;
        eggTypes[3] = EGG_MYSTERY;
        
        for (uint256 i = 0; i < eggTypes.length; i++) {
            balances[i] = balanceOf(user, eggTypes[i]);
        }
        
        return (eggTypes, balances);
    }

    /**
     * @dev Update egg price
     */
    function updateEggPrice(uint256 eggType, uint256 newPrice) external onlyOwner {
        eggInfo[eggType].price = newPrice;
    }

    /**
     * @dev Update egg supply
     */
    function updateEggSupply(uint256 eggType, uint256 newMaxSupply) external onlyOwner {
        eggInfo[eggType].maxSupply = newMaxSupply;
    }

    /**
     * @dev Toggle egg active status
     */
    function toggleEggActive(uint256 eggType) external onlyOwner {
        eggInfo[eggType].isActive = !eggInfo[eggType].isActive;
    }

    /**
     * @dev Set base URI
     */
    function setBaseURI(string memory _baseURI) external onlyOwner {
        baseURI = _baseURI;
        _setURI(_baseURI);
        emit BaseURIUpdated(_baseURI);
    }

    /**
     * @dev Override URI function
     */
    function uri(uint256 tokenId) public view override returns (string memory) {
        return string(abi.encodePacked(baseURI, tokenId.toString(), ".json"));
    }

    /**
     * @dev Withdraw contract balance
     */
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        payable(owner()).transfer(balance);
    }
}