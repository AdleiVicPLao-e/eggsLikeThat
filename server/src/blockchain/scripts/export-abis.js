// scripts/export-abis.js
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("📤 Exporting ABIs for frontend...");

  const abisToExport = [
    "PetNFT",
    "EggNFT",
    "SkinNFT",
    "TechniqueNFT",
    "Marketplace",
  ];

  const exportDir = path.join(__dirname, "../../../../client/src/abis");
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  for (const contractName of abisToExport) {
    const artifactPath = path.join(
      __dirname,
      `../artifacts/contracts/${contractName}.sol/${contractName}.json`
    );
    if (fs.existsSync(artifactPath)) {
      const artifact = require(artifactPath);

      // Export only the ABI, not the entire artifact
      const abiOnly = {
        abi: artifact.abi,
        contractName: artifact.contractName,
      };

      fs.writeFileSync(
        path.join(exportDir, `${contractName}.json`),
        JSON.stringify(abiOnly, null, 2)
      );
      console.log(`✅ Exported ${contractName} ABI`);
    }
  }

  console.log("🎉 ABI export completed!");
}

main().catch(console.error);
