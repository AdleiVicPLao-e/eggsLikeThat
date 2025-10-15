const { run } = require("hardhat");
const { readFileSync } = require("fs");
const path = require("path");

async function main() {
  console.log("Starting contract verification...");

  try {
    const verificationInfo = JSON.parse(
      readFileSync(path.join(__dirname, "..", "verification-info.json"), "utf8")
    );

    for (const contract of verificationInfo.contracts) {
      console.log(`\nVerifying ${contract.name} at ${contract.address}...`);

      try {
        await run("verify:verify", {
          address: contract.address,
          constructorArguments: contract.constructorArguments,
        });
        console.log(`✅ ${contract.name} verified successfully!`);
      } catch (error) {
        if (error.message.includes("Already Verified")) {
          console.log(`✅ ${contract.name} already verified`);
        } else {
          console.error(`❌ Failed to verify ${contract.name}:`, error.message);
        }
      }

      // Add delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    console.log("\n🎉 Verification process completed!");
  } catch (error) {
    console.error("Verification process failed:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
