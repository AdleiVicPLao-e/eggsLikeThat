import React, { useState } from "react";
import { useGame } from "../../context/GameContext";
import { useWallet } from "../../hooks/useWallet";
import Modal from "../UI/Modal";
import Button from "../UI/Button";
import PetCard from "../Pets/PetCard";

const ListPetModal = ({ isOpen, onClose, pet, onListSuccess }) => {
  const [price, setPrice] = useState("");
  const [loading, setLoading] = useState(false);

  const { gameAPI } = useGame();
  const {
    isConnected,
    connect,
    listNFTOnMarketplace,
    account,
    switchNetwork,
    networkConfig,
  } = useWallet();

  // Check if we're on the correct network (31337 for localhost)
  const isCorrectNetwork = networkConfig?.name === "localhost";

  const handleListPet = async () => {
    if (!price || isNaN(price) || parseFloat(price) <= 0) return;

    // Check if wallet is connected
    if (!isConnected) {
      const result = await connect();
      if (!result.success) {
        alert("Please connect your wallet to list pets for sale");
        return;
      }
    }

    // Check if we're on the correct network
    if (!isCorrectNetwork) {
      const switchResult = await switchNetwork(31337); // Switch to localhost
      if (!switchResult.success) {
        alert("Please switch to the correct network (localhost)");
        return;
      }
    }

    setLoading(true);
    try {
      // Use the blockchain hook to list the pet directly on-chain
      const result = await listNFTOnMarketplace(
        "pet", // nftType
        pet.tokenId, // tokenId (from blockchain)
        1, // amount (always 1 for ERC721 pets)
        price // price in ETH
      );

      if (result.success) {
        // Also update the backend database
        const backendResult = await gameAPI.listPet({
          petId: pet.id, // Database ID
          tokenId: pet.tokenId, // Blockchain token ID
          price: parseFloat(price),
          currency: "ETH",
          sellerAddress: account,
          listingTxHash: result.receipt.transactionHash,
        });

        if (backendResult.success) {
          alert("Pet listed successfully on the marketplace!");
          onListSuccess?.();
          onClose();
          setPrice("");
        } else {
          throw new Error(backendResult.error || "Failed to update backend");
        }
      } else {
        throw new Error(result.error || "Failed to list pet on blockchain");
      }
    } catch (error) {
      console.error("Failed to list pet:", error);
      alert(`Failed to list pet: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const calculateNetAmount = () => {
    if (!price) return "0";
    const amount = parseFloat(price);
    const fee = amount * 0.025; // 2.5% marketplace fee
    return (amount - fee).toFixed(4);
  };

  const getNetworkWarning = () => {
    if (!isConnected) return null;

    if (!isCorrectNetwork) {
      return (
        <div className="bg-yellow-500 bg-opacity-20 border border-yellow-500 rounded-lg p-3">
          <p className="text-yellow-400 text-sm">
            🌐 Wrong network. Please switch to localhost (Chain ID: 31337)
          </p>
          <button
            onClick={() => switchNetwork(31337)}
            className="mt-2 px-3 py-1 bg-yellow-500 text-white rounded text-sm hover:bg-yellow-600"
          >
            Switch to Localhost
          </button>
        </div>
      );
    }

    return null;
  };

  const getConnectionStatus = () => {
    if (!isConnected) {
      return (
        <div className="bg-yellow-500 bg-opacity-20 border border-yellow-500 rounded-lg p-3">
          <p className="text-yellow-400 text-sm">
            🔗 You need to connect your wallet to list pets for sale
          </p>
        </div>
      );
    }

    if (isCorrectNetwork) {
      return (
        <div className="bg-green-500 bg-opacity-20 border border-green-500 rounded-lg p-3">
          <p className="text-green-400 text-sm">
            ✅ Connected to {account?.slice(0, 8)}... on {networkConfig.name}
          </p>
        </div>
      );
    }

    return null;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="List Pet for Sale"
      size="md"
    >
      <div className="p-6 space-y-6">
        {/* Pet Preview */}
        {pet && (
          <div className="flex justify-center">
            <div className="w-64">
              <PetCard pet={pet} />
            </div>
          </div>
        )}

        {/* Network Status */}
        {getNetworkWarning()}

        {/* Connection Status */}
        {getConnectionStatus()}

        {/* Price Input */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">
            Listing Price (ETH)
          </label>
          <input
            type="number"
            step="0.001"
            min="0.001"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter price in ETH"
          />
          <p className="text-xs text-gray-400">Minimum price: 0.001 ETH</p>
        </div>

        {/* Market Fee Info */}
        <div className="bg-gray-700 rounded-lg p-3 text-sm">
          <div className="flex justify-between text-gray-300">
            <span>Marketplace Fee:</span>
            <span>2.5%</span>
          </div>
          <div className="flex justify-between text-gray-300 mt-1">
            <span>You Receive:</span>
            <span>{calculateNetAmount()} ETH</span>
          </div>
          <div className="flex justify-between text-gray-400 mt-1 text-xs">
            <span>Platform Wallet:</span>
            <span>{process.env.REACT_APP_PLATFORM_WALLET?.slice(0, 8)}...</span>
          </div>
        </div>

        {/* Blockchain Info */}
        <div className="bg-blue-500 bg-opacity-20 border border-blue-500 rounded-lg p-3">
          <p className="text-blue-400 text-sm font-medium">
            Blockchain Listing
          </p>
          <p className="text-blue-300 text-xs mt-1">
            This will create a smart contract listing on the blockchain. The pet
            will be transferred to the marketplace contract until sold.
          </p>
          <div className="mt-2 text-xs text-blue-300 space-y-1">
            <div className="flex justify-between">
              <span>Contract:</span>
              <span>
                {process.env.REACT_APP_MARKETPLACE_CONTRACT?.slice(0, 8)}...
              </span>
            </div>
            <div className="flex justify-between">
              <span>Pet NFT:</span>
              <span>
                {process.env.REACT_APP_PET_NFT_CONTRACT?.slice(0, 8)}...
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-3 pt-4">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            onClick={handleListPet}
            loading={loading}
            disabled={
              !price ||
              parseFloat(price) < 0.001 ||
              !isConnected ||
              !isCorrectNetwork
            }
          >
            {!isConnected
              ? "Connect Wallet"
              : !isCorrectNetwork
              ? "Switch Network"
              : "List on Marketplace"}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ListPetModal;
