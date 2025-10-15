import React, { useState } from "react";
import { useBlockchain } from "../../hooks/useBlockchain";
import Modal from "../UI/Modal";
import Button from "../UI/Button";
import PetCard from "../Pets/PetCard";

const ListPetModal = ({ isOpen, onClose, pet }) => {
  const [price, setPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const { listPet } = useBlockchain();

  const handleListPet = async () => {
    if (!price || isNaN(price) || parseFloat(price) <= 0) return;

    setLoading(true);
    try {
      await listPet(pet.id, price);
      onClose();
      setPrice("");
    } catch (error) {
      console.error("Failed to list pet:", error);
    } finally {
      setLoading(false);
    }
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
            <span>
              {price ? (parseFloat(price) * 0.975).toFixed(4) : "0"} ETH
            </span>
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
            disabled={!price || parseFloat(price) < 0.001}
          >
            List Pet
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ListPetModal;
