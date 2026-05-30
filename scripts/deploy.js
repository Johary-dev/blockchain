const { ethers } = require("hardhat");

async function main() {
  console.log("Déploiement du contrat DecentralizedVoting...");

  const DecentralizedVoting = await ethers.getContractFactory("DecentralizedVoting");

  const voting = await DecentralizedVoting.deploy();

  await voting.waitForDeployment();

  const contractAddress = await voting.getAddress();

  console.log("Contrat déployé avec succès !");
  console.log("Adresse du contrat :", contractAddress);

  const owner = await voting.owner();
  const deadline = await voting.deadline();
  const proposalCount = await voting.getProposalCount();

  console.log("Owner :", owner);
  console.log("Deadline :", deadline.toString());
  console.log("Nombre de propositions :", proposalCount.toString());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});