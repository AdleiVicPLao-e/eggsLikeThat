// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title GameToken
 * @dev ERC-20 token for PetVerse in-game currency
 */
contract GameToken is ERC20, ERC20Burnable, Ownable, Pausable {
    // Mapping for authorized minters (game contracts)
    mapping(address => bool) public minters;

    // Events
    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);
    event TokensMinted(address indexed to, uint256 amount);
    event TokensBurned(address indexed from, uint256 amount);

    // Constructor
    constructor() ERC20("PetVerse Token", "PETV") {
        // Initial supply: 1 billion tokens
        _mint(msg.sender, 1_000_000_000 * 10 ** decimals());
    }

    /**
     * @dev Mint tokens (only authorized minters)
     */
    function mint(address to, uint256 amount) external whenNotPaused {
        require(minters[msg.sender], "Not authorized minter");
        _mint(to, amount);
        emit TokensMinted(to, amount);
    }

    /**
     * @dev Burn tokens from any address (only owner)
     */
    function burnFrom(address account, uint256 amount) public override onlyOwner {
        _burn(account, amount);
        emit TokensBurned(account, amount);
    }

    /**
     * @dev Add minter address
     */
    function addMinter(address minter) external onlyOwner {
        minters[minter] = true;
        emit MinterAdded(minter);
    }

    /**
     * @dev Remove minter address
     */
    function removeMinter(address minter) external onlyOwner {
        minters[minter] = false;
        emit MinterRemoved(minter);
    }

    /**
     * @dev Pause token transfers
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause token transfers
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Batch transfer tokens
     */
    function batchTransfer(
        address[] memory recipients,
        uint256[] memory amounts
    ) external whenNotPaused {
        require(recipients.length == amounts.length, "Arrays length mismatch");

        for (uint256 i = 0; i < recipients.length; i++) {
            transfer(recipients[i], amounts[i]);
        }
    }

    /**
     * @dev Get minter status
     */
    function isMinter(address account) external view returns (bool) {
        return minters[account];
    }

    // Override transfer to include pausable
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override whenNotPaused {
        super._beforeTokenTransfer(from, to, amount);
    }
}