// Frontend de vote décentralisé basé sur le style de tp_reponse/tp5/index.html et app.js
// Contrat : DecentralizedVoting (projet_corrige.sol)
const CONTRACT_ADDRESS = '0xC85350526D7C4bC61cC88597C144Ce8e2aaED851';

const ABI = [
    'function getProposalCount() view returns (uint256)',
    'function getProposal(uint256) view returns (string memory, uint256)',
    'function vote(uint256) external',
    'function hasVoted(address) view returns (bool)',
    'function isVotingOpen() view returns (bool)',
    'function votingClosed() view returns (bool)',
    'function getRemainingTime() view returns (uint256)',
    'function deadline() view returns (uint256)',
    'event Voted(address indexed voter, uint256 indexed proposalId)',
];

let provider;
let signer;
let contract;
let userAddress;

const statusEl = document.getElementById('status');
const spanAddr = document.getElementById('spanAddr');
const spanNetwork = document.getElementById('spanNetwork');
const spanContract = document.getElementById('spanContract');
const spanVotingOpen = document.getElementById('spanVotingOpen');
const spanProposalCount = document.getElementById('spanProposalCount');
const proposalList = document.getElementById('proposalList');
const btnConnect = document.getElementById('btnConnect');
const btnRefresh = document.getElementById('btnRefresh');

function setStatus(message, type = '') {
    statusEl.textContent = message;
    statusEl.className = type;
}

function formatAddress(address) {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatSeconds(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const parts = [];
    if (days) parts.push(`${days}j`);
    if (hours) parts.push(`${hours}h`);
    if (minutes) parts.push(`${minutes}m`);
    if (!parts.length) parts.push(`${seconds}s`);
    return parts.join(' ');
}

async function verifyNetwork() {
    if (!provider) return;
    const network = await provider.getNetwork();
    let chainIdNum = network.chainId;
    if (typeof chainIdNum === 'string') {
        chainIdNum = chainIdNum.startsWith('0x') ? parseInt(chainIdNum, 16) : parseInt(chainIdNum, 10);
    }
    spanNetwork.textContent = `${network.name ?? 'unknown'} (chainId=${chainIdNum})`;
    if (Number(chainIdNum) !== 11155111) {
        setStatus(`⚠️ Veuillez vous connecter au réseau Sepolia dans MetaMask (detecté: chainId=${network.chainId}).`, 'error');
        throw new Error('Réseau incorrect');
    }
}

async function initializeContract() {
    contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
    spanContract.textContent = CONTRACT_ADDRESS;
}

async function updateContractInfo() {
    try {
        const proposalCount = Number(await contract.getProposalCount());
        const votingOpen = await contract.isVotingOpen();
        const remainingTime = Number(await contract.getRemainingTime());
        const hasVoted = await contract.hasVoted(userAddress);

        spanProposalCount.textContent = proposalCount;
        spanVotingOpen.textContent = votingOpen ? `Oui — reste ${formatSeconds(remainingTime)}` : 'Non';

        await loadProposals(proposalCount, votingOpen, hasVoted);
    } catch (error) {
        setStatus(`❌ Impossible de récupérer les informations du contrat : ${error.message}`, 'error');
    }
}

function createProposalCard(index, name, votes, votingOpen, hasVoted) {
    const card = document.createElement('div');
    card.className = 'proposal';

    const header = document.createElement('div');
    header.className = 'proposal-header';
    header.innerHTML = `
        <div>
            <strong>Proposition ${index + 1}</strong>
            <p>${name}</p>
        </div>
        <span class="badge">Votes : ${votes}</span>
    `;

    const button = document.createElement('button');
    button.textContent = hasVoted ? 'Vous avez déjà voté' : 'Voter pour cette proposition';
    button.disabled = !votingOpen || hasVoted;
    button.addEventListener('click', async () => await voteForProposal(index));

    card.append(header, button);
    return card;
}

async function loadProposals(proposalCount, votingOpen, hasVoted) {
    proposalList.innerHTML = '';
    if (proposalCount === 0) {
        proposalList.innerHTML = '<p>Aucune proposition trouvée.</p>';
        return;
    }

    for (let i = 0; i < proposalCount; i += 1) {
        try {
            const [name, voteCount] = await contract.getProposal(i);
            const card = createProposalCard(i, name, voteCount.toString(), votingOpen, hasVoted);
            proposalList.appendChild(card);
        } catch (error) {
            console.error('Erreur proposition', i, error);
            const errorNode = document.createElement('p');
            errorNode.textContent = `Erreur lors de la lecture de la proposition ${i + 1}`;
            proposalList.appendChild(errorNode);
        }
    }
}

async function voteForProposal(proposalId) {
    try {
        setStatus('⏳ Transaction en préparation... Confirmez dans MetaMask.', 'pending');
        const tx = await contract.vote(proposalId);
        setStatus(`⏳ Transaction envoyée — TxHash: ${tx.hash}\nAttente de confirmation...`, 'pending');
        await tx.wait();
        setStatus('✅ Vote enregistré avec succès.', 'success');
        await updateContractInfo();
    } catch (error) {
        setStatus(`❌ Erreur de vote : ${error.message}`, 'error');
    }
}

btnConnect.addEventListener('click', async () => {
    if (!window.ethereum) {
        setStatus('❌ MetaMask non détecté. Installez MetaMask et rechargez la page.', 'error');
        return;
    }
    if (CONTRACT_ADDRESS === '0xREPLACE_WITH_YOUR_VOTING_CONTRACT_ADDRESS') {
        setStatus('❌ Remplacez CONTRACT_ADDRESS dans app.js par l\'adresse de votre contrat DecentralizedVoting.', 'error');
        return;
    }

    try {
        setStatus('⏳ Connexion à MetaMask...', 'pending');
        provider = new ethers.BrowserProvider(window.ethereum);
        await provider.send('eth_requestAccounts', []);
        signer = await provider.getSigner();
        userAddress = await signer.getAddress();

        await verifyNetwork();
        await initializeContract();
        await updateContractInfo();

        spanAddr.textContent = formatAddress(userAddress);
        btnRefresh.disabled = false;
        setStatus('✅ Connecté et prêt à voter !', 'success');
    } catch (error) {
        setStatus(`❌ Erreur : ${error.message}`, 'error');
    }
});

btnRefresh.addEventListener('click', async () => {
    setStatus('⏳ Actualisation des propositions...', 'pending');
    await updateContractInfo();
    setStatus('✅ Propositions mises à jour.', 'success');
});

window.addEventListener('DOMContentLoaded', () => {
    spanContract.textContent = CONTRACT_ADDRESS;
    spanNetwork.textContent = '—';
    setStatus('Veuillez connecter MetaMask et vérifier l\'adresse du contrat.', 'pending');
});
