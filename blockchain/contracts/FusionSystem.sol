// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title FusionSystem
 * @dev Handles pet fusion mechanics for PetVerse game
 */
contract FusionSystem is ReentrancyGuard, Ownable {
    using Counters for Counters.Counter;

    // Interfaces
    IERC721 public petNFT;

    // Fusion costs in wei
    mapping(uint8 => uint256) public fusionCosts;

    // Fusion success rates (basis points: 10000 = 100%)
    mapping(uint8 => uint256) public fusionSuccessRates;

    // Events
    event FusionStarted(
        address indexed user,
        uint256[] inputTokenIds,
        uint8 targetTier,
        uint256 fusionId
    );

    event FusionCompleted(
        address indexed user,
        uint256 fusionId,
        uint256 newTokenId,
        bool success,
        uint8 newTier
    );

    event FusionFailed(
        address indexed user,
        uint256 fusionId,
        uint256[] burnedTokenIds
    );

    // Fusion request structure
    struct FusionRequest {
        address user;
        uint256[] inputTokenIds;
        uint8 targetTier;
        uint256 requestTime;
        bool completed;
        bool success;
        uint256 newTokenId;
    }

    // Mappings
    mapping(uint256 => FusionRequest) public fusionRequests;
    Counters.Counter private _fusionIdCounter;

    // Constructor
    constructor(address _petNFT) {
        petNFT = IERC721(_petNFT);
        
        // Initialize fusion costs (in wei)
        fusionCosts[1] = 0.001 ether; // Uncommon
        fusionCosts[2] = 0.0025 ether; // Rare
        fusionCosts[3] = 0.005 ether; // Epic
        fusionCosts[4] = 0.01 ether; // Legendary

        // Initialize success rates (basis points)
        fusionSuccessRates[1] = 8000; // 80%
        fusionSuccessRates[2] = 6000; // 60%
        fusionSuccessRates[3] = 4000; // 40%
        fusionSuccessRates[4] = 2000; // 20%
    }

    /**
     * @dev Start a fusion process
     */
    function startFusion(
        uint256[] memory inputTokenIds,
        uint8 targetTier
    ) external payable nonReentrant returns (uint256) {
        require(inputTokenIds.length >= 2, "Need at least 2 pets");
        require(inputTokenIds.length <= 5, "Max 5 pets allowed");
        require(targetTier >= 1 && targetTier <= 4, "Invalid target tier");
        require(msg.value >= fusionCosts[targetTier], "Insufficient fusion cost");

        // Verify ownership and transfer pets to this contract
        for (uint256 i = 0; i < inputTokenIds.length; i++) {
            require(petNFT.ownerOf(inputTokenIds[i]) == msg.sender, "Not pet owner");
            petNFT.transferFrom(msg.sender, address(this), inputTokenIds[i]);
        }

        uint256 fusionId = _fusionIdCounter.current();
        _fusionIdCounter.increment();

        fusionRequests[fusionId] = FusionRequest({
            user: msg.sender,
            inputTokenIds: inputTokenIds,
            targetTier: targetTier,
            requestTime: block.timestamp,
            completed: false,
            success: false,
            newTokenId: 0
        });

        emit FusionStarted(msg.sender, inputTokenIds, targetTier, fusionId);

        return fusionId;
    }

    /**
     * @dev Complete fusion (called by backend/oracle)
     */
    function completeFusion(
        uint256 fusionId,
        bool success,
        uint256 newTokenId
    ) external onlyOwner {
        FusionRequest storage request = fusionRequests[fusionId];
        require(!request.completed, "Fusion already completed");
        require(request.user != address(0), "Invalid fusion ID");

        request.completed = true;
        request.success = success;
        request.newTokenId = newTokenId;

        if (success) {
            // Transfer new pet to user (minted by backend)
            if (newTokenId != 0) {
                petNFT.transferFrom(address(this), request.user, newTokenId);
            }
            
            emit FusionCompleted(request.user, fusionId, newTokenId, true, request.targetTier);
        } else {
            // Burn input pets on failure
            for (uint256 i = 0; i < request.inputTokenIds.length; i++) {
                // In a real implementation, you might want to burn the NFTs
                // For now, we'll keep them in the contract
            }
            
            emit FusionFailed(request.user, fusionId, request.inputTokenIds);
        }
    }

    /**
     * @dev Calculate fusion success chance based on input pets
     */
    function calculateSuccessChance(
        uint256[] memory inputTokenIds,
        uint8 targetTier
    ) external view returns (uint256) {
        // This would require knowing pet tiers - in production, you'd query PetNFT contract
        // For now, return base success rate
        return fusionSuccessRates[targetTier];
    }

    /**
     * @dev Get fusion request details
     */
    function getFusionRequest(uint256 fusionId) external view returns (FusionRequest memory) {
        return fusionRequests[fusionId];
    }

    /**
     * @dev Get user's fusion history
     */
    function getUserFusions(address user) external view returns (uint256[] memory) {
        uint256 totalFusions = _fusionIdCounter.current();
        uint256 userFusionCount = 0;

        // Count user's fusions
        for (uint256 i = 0; i < totalFusions; i++) {
            if (fusionRequests[i].user == user) {
                userFusionCount++;
            }
        }

        uint256[] memory userFusionIds = new uint256[](userFusionCount);
        uint256 currentIndex = 0;

        for (uint256 i = 0; i < totalFusions; i++) {
            if (fusionRequests[i].user == user) {
                userFusionIds[currentIndex] = i;
                currentIndex++;
            }
        }

        return userFusionIds;
    }

    /**
     * @dev Update fusion cost
     */
    function updateFusionCost(uint8 tier, uint256 newCost) external onlyOwner {
        fusionCosts[tier] = newCost;
    }

    /**
     * @dev Update fusion success rate
     */
    function updateSuccessRate(uint8 tier, uint256 newRate) external onlyOwner {
        require(newRate <= 10000, "Rate cannot exceed 100%");
        fusionSuccessRates[tier] = newRate;
    }

    /**
     * @dev Withdraw contract funds
     */
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        payable(owner()).transfer(balance);
    }

    /**
     * @dev Emergency function to return pets to owners (in case of issues)
     */
    function emergencyReturnPets(uint256 fusionId) external onlyOwner {
        FusionRequest storage request = fusionRequests[fusionId];
        require(!request.completed, "Fusion already completed");

        for (uint256 i = 0; i < request.inputTokenIds.length; i++) {
            petNFT.transferFrom(address(this), request.user, request.inputTokenIds[i]);
        }

        request.completed = true;
    }
}