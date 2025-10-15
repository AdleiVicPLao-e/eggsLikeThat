// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

/**
 * @title Marketplace
 * @dev Decentralized marketplace for PetVerse NFTs
 */
contract Marketplace is ReentrancyGuard, Ownable {
    // Constants
    uint256 public constant MARKETPLACE_FEE = 250; // 2.5% in basis points
    uint256 public constant ROYALTY_FEE = 100; // 1.0% in basis points

    // Interfaces
    IERC721 public petNFT;
    IERC1155 public eggItem;

    // Listing structure
    struct Listing {
        address seller;
        uint256 tokenId;
        uint256 price;
        bool isActive;
        uint256 listingTime;
        bool isERC1155;
        uint256 amount; // For ERC1155 items
    }

    // Mappings
    mapping(uint256 => Listing) public listings;
    mapping(address => uint256[]) public userListings;

    // Events
    event ItemListed(
        address indexed seller,
        uint256 indexed tokenId,
        uint256 price,
        bool isERC1155,
        uint256 amount,
        uint256 listingTime
    );

    event ItemSold(
        address indexed seller,
        address indexed buyer,
        uint256 indexed tokenId,
        uint256 price,
        uint256 saleTime
    );

    event ListingCancelled(
        address indexed seller,
        uint256 indexed tokenId,
        uint256 cancelTime
    );

    event PriceUpdated(
        address indexed seller,
        uint256 indexed tokenId,
        uint256 newPrice
    );

    // Modifiers
    modifier onlyTokenOwner(uint256 tokenId, bool isERC1155) {
        if (isERC1155) {
            require(eggItem.balanceOf(msg.sender, tokenId) > 0, "Not token owner");
        } else {
            require(petNFT.ownerOf(tokenId) == msg.sender, "Not token owner");
        }
        _;
    }

    modifier isListed(uint256 tokenId) {
        require(listings[tokenId].isActive, "Item not listed");
        _;
    }

    modifier notListed(uint256 tokenId) {
        require(!listings[tokenId].isActive, "Item already listed");
        _;
    }

    // Constructor
    constructor(address _petNFT, address _eggItem) {
        petNFT = IERC721(_petNFT);
        eggItem = IERC1155(_eggItem);
    }

    /**
     * @dev List an item for sale
     */
    function listItem(
        uint256 tokenId,
        uint256 price,
        bool isERC1155,
        uint256 amount
    ) external nonReentrant onlyTokenOwner(tokenId, isERC1155) notListed(tokenId) {
        require(price > 0, "Price must be greater than 0");
        
        listings[tokenId] = Listing({
            seller: msg.sender,
            tokenId: tokenId,
            price: price,
            isActive: true,
            listingTime: block.timestamp,
            isERC1155: isERC1155,
            amount: amount
        });

        userListings[msg.sender].push(tokenId);

        emit ItemListed(msg.sender, tokenId, price, isERC1155, amount, block.timestamp);
    }

    /**
     * @dev Purchase a listed item
     */
    function purchaseItem(uint256 tokenId) external payable nonReentrant isListed(tokenId) {
        Listing storage listing = listings[tokenId];
        require(msg.sender != listing.seller, "Cannot purchase your own item");
        require(msg.value >= listing.price, "Insufficient payment");

        // Calculate fees
        uint256 marketplaceFee = (listing.price * MARKETPLACE_FEE) / 10000;
        uint256 royaltyFee = (listing.price * ROYALTY_FEE) / 10000;
        uint256 sellerAmount = listing.price - marketplaceFee - royaltyFee;

        // Transfer payment
        payable(listing.seller).transfer(sellerAmount);
        payable(owner()).transfer(marketplaceFee + royaltyFee);

        // Transfer NFT
        if (listing.isERC1155) {
            eggItem.safeTransferFrom(listing.seller, msg.sender, tokenId, listing.amount, "");
        } else {
            petNFT.safeTransferFrom(listing.seller, msg.sender, tokenId);
        }

        // Update listing
        listing.isActive = false;

        emit ItemSold(listing.seller, msg.sender, tokenId, listing.price, block.timestamp);
    }

    /**
     * @dev Cancel a listing
     */
    function cancelListing(uint256 tokenId) external nonReentrant isListed(tokenId) {
        Listing storage listing = listings[tokenId];
        require(msg.sender == listing.seller, "Not the seller");

        listing.isActive = false;

        emit ListingCancelled(msg.sender, tokenId, block.timestamp);
    }

    /**
     * @dev Update listing price
     */
    function updateListingPrice(uint256 tokenId, uint256 newPrice) external nonReentrant isListed(tokenId) {
        Listing storage listing = listings[tokenId];
        require(msg.sender == listing.seller, "Not the seller");
        require(newPrice > 0, "Price must be greater than 0");

        listing.price = newPrice;

        emit PriceUpdated(msg.sender, tokenId, newPrice);
    }

    /**
     * @dev Get active listings
     */
    function getActiveListings(uint256 cursor, uint256 howMany) external view returns (Listing[] memory, uint256) {
        uint256 totalListings = getTotalActiveListings();
        uint256 end = cursor + howMany;
        
        if (end > totalListings) {
            end = totalListings;
        }

        Listing[] memory activeListings = new Listing[](end - cursor);
        uint256 count = 0;

        for (uint256 i = cursor; i < end; i++) {
            // This is a simplified version - in production you'd maintain an array of active listings
            // For now, we'll return empty and implement proper indexing in a real scenario
            break;
        }

        return (activeListings, end);
    }

    /**
     * @dev Get user's active listings
     */
    function getUserActiveListings(address user) external view returns (Listing[] memory) {
        uint256[] memory userListingIds = userListings[user];
        uint256 activeCount = 0;

        // Count active listings
        for (uint256 i = 0; i < userListingIds.length; i++) {
            if (listings[userListingIds[i]].isActive) {
                activeCount++;
            }
        }

        Listing[] memory activeListings = new Listing[](activeCount);
        uint256 currentIndex = 0;

        for (uint256 i = 0; i < userListingIds.length; i++) {
            uint256 tokenId = userListingIds[i];
            if (listings[tokenId].isActive) {
                activeListings[currentIndex] = listings[tokenId];
                currentIndex++;
            }
        }

        return activeListings;
    }

    /**
     * @dev Get listing details
     */
    function getListing(uint256 tokenId) external view returns (Listing memory) {
        return listings[tokenId];
    }

    /**
     * @dev Get total active listings count (simplified)
     */
    function getTotalActiveListings() public pure returns (uint256) {
        // In production, you'd maintain a counter
        return 0;
    }

    /**
     * @dev Emergency withdrawal (only owner)
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        payable(owner()).transfer(balance);
    }
}