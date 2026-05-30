const EXPECTED_CHAIN_ID = "0xaa36a7";

const CONTRACT_ABI = [
  "function vote(uint256 proposalId) external",
  "function closeVoting() external",
  "function getProposal(uint256 proposalId) external view returns (string name, uint256 voteCount)",
  "function getProposalCount() external view returns (uint256)",
  "function getAllProposals() external view returns (tuple(string name,uint256 voteCount)[])",
  "function getWinner() public view returns (uint256 winningProposalId, string winningProposalName, uint256 winningVoteCount)",
  "function isVotingOpen() external view returns (bool)",
  "function getRemainingTime() external view returns (uint256)",
  "function hasVoted(address) external view returns (bool)"
];

const connectWalletButton = document.querySelector("#connectWallet");
const loadContractButton = document.querySelector("#loadContract");
const closeVotingButton = document.querySelector("#closeVoting");
const showWinnerButton = document.querySelector("#showWinner");
const contractAddressInput = document.querySelector("#contractAddress");
const accountOutput = document.querySelector("#account");
const votingStateOutput = document.querySelector("#votingState");
const remainingTimeOutput = document.querySelector("#remainingTime");
const proposalsOutput = document.querySelector("#proposals");
const messageOutput = document.querySelector("#message");

let provider;
let signer;
let contract;
let currentAccount;

function setMessage(text, type = "") {
  messageOutput.textContent = text;
  messageOutput.className = `message ${type}`;
}

function shortenAddress(address) {
  if (!address) return "Non connecté";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatDuration(totalSeconds) {
  const seconds = Number(totalSeconds);
  if (seconds <= 0) return "0 seconde";

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;

  return [
    days ? `${days} j` : "",
    hours ? `${hours} h` : "",
    minutes ? `${minutes} min` : "",
    !days && !hours ? `${rest} s` : ""
  ].filter(Boolean).join(" ");
}

async function ensureWallet() {
  if (!window.ethereum) {
    throw new Error("MetaMask n'est pas installé dans ce navigateur.");
  }

  provider = new ethers.BrowserProvider(window.ethereum);
  const accounts = await provider.send("eth_requestAccounts", []);
  currentAccount = accounts[0];
  signer = await provider.getSigner();
  accountOutput.textContent = shortenAddress(currentAccount);

  const network = await provider.send("eth_chainId", []);
  if (network !== EXPECTED_CHAIN_ID) {
    setMessage("Veuillez sélectionner le réseau Sepolia dans MetaMask.", "error");
  }
}

async function getContract() {
  const address = contractAddressInput.value.trim();
  if (!ethers.isAddress(address)) {
    throw new Error("Adresse de contrat invalide. Collez l'adresse Sepolia au format 0x...");
  }

  if (!signer) {
    await ensureWallet();
  }

  contract = new ethers.Contract(address, CONTRACT_ABI, signer);
  return contract;
}

async function refreshData() {
  try {
    const votingContract = await getContract();
    setMessage("Lecture des données en cours...");

    const [isOpen, remaining, proposals, alreadyVoted] = await Promise.all([
      votingContract.isVotingOpen(),
      votingContract.getRemainingTime(),
      votingContract.getAllProposals(),
      votingContract.hasVoted(currentAccount)
    ]);

    votingStateOutput.textContent = isOpen ? "Ouvert" : "Fermé";
    remainingTimeOutput.textContent = formatDuration(remaining);
    renderProposals(proposals, isOpen, alreadyVoted);
    setMessage("Données chargées avec succès.", "ok");
  } catch (error) {
    setMessage(error.shortMessage || error.message, "error");
  }
}

function renderProposals(proposals, isOpen, alreadyVoted) {
  proposalsOutput.innerHTML = "";

  if (!proposals.length) {
    proposalsOutput.innerHTML = "<p>Aucune proposition trouvée dans le contrat.</p>";
    return;
  }

  proposals.forEach((proposal, index) => {
    const row = document.createElement("article");
    row.className = "proposal";

    const content = document.createElement("div");
    content.innerHTML = `
      <div class="proposal-title">${index}. ${proposal.name}</div>
      <div class="votes">${proposal.voteCount.toString()} vote(s)</div>
    `;

    const button = document.createElement("button");
    button.textContent = alreadyVoted ? "Déjà voté" : "Voter";
    button.disabled = !isOpen || alreadyVoted;
    button.addEventListener("click", () => voteFor(index));

    row.append(content, button);
    proposalsOutput.appendChild(row);
  });
}

async function voteFor(proposalId) {
  try {
    const votingContract = await getContract();
    setMessage("Transaction de vote envoyée à MetaMask...");
    const tx = await votingContract.vote(proposalId);
    setMessage(`Transaction envoyée : ${tx.hash}`);
    await tx.wait();
    setMessage("Vote confirmé sur la blockchain.", "ok");
    await refreshData();
  } catch (error) {
    setMessage(error.shortMessage || error.message, "error");
  }
}

async function closeVoting() {
  try {
    const votingContract = await getContract();
    setMessage("Demande de clôture envoyée à MetaMask...");
    const tx = await votingContract.closeVoting();
    setMessage(`Transaction envoyée : ${tx.hash}`);
    await tx.wait();
    setMessage("Vote clôturé.", "ok");
    await refreshData();
  } catch (error) {
    setMessage(error.shortMessage || error.message, "error");
  }
}

async function showWinner() {
  try {
    const votingContract = await getContract();
    const winner = await votingContract.getWinner();
    setMessage(`Gagnant : ${winner.winningProposalName} avec ${winner.winningVoteCount.toString()} vote(s).`, "ok");
  } catch (error) {
    setMessage(error.shortMessage || error.message, "error");
  }
}

connectWalletButton.addEventListener("click", async () => {
  try {
    await ensureWallet();
    setMessage("MetaMask connecté.", "ok");
  } catch (error) {
    setMessage(error.message, "error");
  }
});

loadContractButton.addEventListener("click", refreshData);
closeVotingButton.addEventListener("click", closeVoting);
showWinnerButton.addEventListener("click", showWinner);

if (window.ethereum) {
  window.ethereum.on("accountsChanged", () => window.location.reload());
  window.ethereum.on("chainChanged", () => window.location.reload());
}
