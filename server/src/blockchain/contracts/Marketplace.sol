// contracts/Marketplace.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract Marketplace is ReentrancyGuard, IERC1155Receiver {
    using Counters for Counters.Counter;
    
    enum ItemType {
        PET,
        EGG,
        SKIN,
        TECHNIQUE
    }
    
    struct Listing {
        address seller;
        address nftContract;
        ItemType itemType;
        uint256 tokenId;
        uint256 amount; // For ERC1155 items
        uint256 price;
        bool active;
    }
    
    Counters.Counter private _listingIdCounter;
    
    mapping(uint256 => Listing) public listings;
    mapping(address => mapping(uint256 => uint256)) public listingIds; // nftContract -> tokenId -> listingId
    
    uint256 public platformFee = 250; // 2.5%
    address public platformWallet;
    
    event ItemListed(
        uint256 indexed listingId,
        address indexed seller,
        address indexed nftContract,
        ItemType itemType,
        uint256 tokenId,
        uint256 amount,
        uint256 price
    );
    
    event ItemSold(
        uint256 indexed listingId,
        address indexed seller,
        address indexed buyer,
        address nftContract,
        ItemType itemType,
        uint256 tokenId,
        uint256 amount,
        uint256 price
    );
    
    event ListingCancelled(
        uint256 indexed listingId,
        address indexed seller,
        address nftContract,
        uint256 tokenId
    );
    
    constructor(address _platformWallet) {
        platformWallet = _platformWallet;
    }
    
    function listItem(
        address nftContract,
        ItemType itemType,
        uint256 tokenId,
        uint256 amount,
        uint256 price
    ) external nonReentrant {
        require(price > 0, "Price must be greater than 0");
        require(amount > 0, "Amount must be greater than 0");
        
        // Check if item is already listed
        require(listingIds[nftContract][tokenId] == 0, "Item already listed");
        
        if (itemType == ItemType.PET) {
            // ERC721 - Transfer pet to marketplace
            IERC721(nftContract).transferFrom(msg.sender, address(this), tokenId);
        } else {
            // ERC1155 - Transfer egg/skin/technique to marketplace
            IERC1155(nftContract).safeTransferFrom(msg.sender, address(this), tokenId, amount, "");
        }
        
        _listingIdCounter.increment();
        uint256 listingId = _listingIdCounter.current();
        
        listings[listingId] = Listing({
            seller: msg.sender,
            nftContract: nftContract,
            itemType: itemType,
            tokenId: tokenId,
            amount: amount,
            price: price,
            active: true
        });
        
        listingIds[nftContract][tokenId] = listingId;
        
        emit ItemListed(listingId, msg.sender, nftContract, itemType, tokenId, amount, price);
    }
    
    function buyItem(uint256 listingId) external payable nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.active, "Item not for sale");
        require(msg.value == listing.price, "Incorrect payment amount");
        
        // Calculate fees
        uint256 platformFeeAmount = (msg.value * platformFee) / 10000;
        uint256 sellerAmount = msg.value - platformFeeAmount;
        
        // Transfer NFT to buyer
        if (listing.itemType == ItemType.PET) {
            IERC721(listing.nftContract).transferFrom(address(this), msg.sender, listing.tokenId);
        } else {
            IERC1155(listing.nftContract).safeTransferFrom(
                address(this), 
                msg.sender, 
                listing.tokenId, 
                listing.amount, 
                ""
            );
        }
        
        // Transfer funds
        payable(listing.seller).transfer(sellerAmount);
        payable(platformWallet).transfer(platformFeeAmount);
        
        // Update listing
        listing.active = false;
        listingIds[listing.nftContract][listing.tokenId] = 0;
        
        emit ItemSold(
            listingId,
            listing.seller,
            msg.sender,
            listing.nftContract,
            listing.itemType,
            listing.tokenId,
            listing.amount,
            listing.price
        );
    }
    
    function cancelListing(uint256 listingId) external nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.seller == msg.sender, "Not the seller");
        require(listing.active, "Listing not active");
        
        // Return NFT to seller
        if (listing.itemType == ItemType.PET) {
            IERC721(listing.nftContract).transferFrom(address(this), msg.sender, listing.tokenId);
        } else {
            IERC1155(listing.nftContract).safeTransferFrom(
                address(this), 
                msg.sender, 
                listing.tokenId, 
                listing.amount, 
                ""
            );
        }
        
        listing.active = false;
        listingIds[listing.nftContract][listing.tokenId] = 0;
        
        emit ListingCancelled(listingId, msg.sender, listing.nftContract, listing.tokenId);
    }
    
    // ERC1155 Receiver Implementation - ADD THESE FUNCTIONS
    function onERC1155Received(
        address,
        address,
        uint256,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return this.onERC1155Received.selector;
    }
    
    function onERC1155BatchReceived(
        address,
        address,
        uint256[] calldata,
        uint256[] calldata,
        bytes calldata
    ) external pure override returns (bytes4) {
        return this.onERC1155BatchReceived.selector;
    }
    
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return 
            interfaceId == type(IERC1155Receiver).interfaceId ||
            interfaceId == 0x01ffc9a7; // ERC165
    }
    
    // Add this public function to access the listing counter
    function getTotalListings() external view returns (uint256) {
        return _listingIdCounter.current();
    }
    
    function getListing(uint256 listingId) external view returns (Listing memory) {
        return listings[listingId];
    }
    
    function getListingByToken(address nftContract, uint256 tokenId) external view returns (Listing memory) {
        uint256 listingId = listingIds[nftContract][tokenId];
        return listings[listingId];
    }
    
    function getActiveListings() external view returns (Listing[] memory) {
        uint256 totalListings = _listingIdCounter.current();
        uint256 activeCount = 0;
        
        // Count active listings
        for (uint256 i = 1; i <= totalListings; i++) {
            if (listings[i].active) {
                activeCount++;
            }
        }
        
        // Create array of active listings
        Listing[] memory activeListings = new Listing[](activeCount);
        uint256 currentIndex = 0;
        
        for (uint256 i = 1; i <= totalListings; i++) {
            if (listings[i].active) {
                activeListings[currentIndex] = listings[i];
                currentIndex++;
            }
        }
        
        return activeListings;
    }
    
    function setPlatformFee(uint256 _platformFee) external {
        require(msg.sender == platformWallet, "Only platform wallet");
        platformFee = _platformFee;
    }
    
    function setPlatformWallet(address _platformWallet) external {
        require(msg.sender == platformWallet, "Only platform wallet");
        platformWallet = _platformWallet;
    }
}