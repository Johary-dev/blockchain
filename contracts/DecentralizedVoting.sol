// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @title DecentralizedVoting
/// @author Tantely, Johary, Sabrina, Aldonis
/// @notice Contrat de vote décentralisé : propositions on-chain, un vote par adresse et clôture par deadline.
/// @dev Ce contrat utilise OpenZeppelin Ownable pour gérer les actions réservées au propriétaire.
contract DecentralizedVoting is Ownable {
    /// @notice Représente une proposition soumise au vote.
    /// @param name Nom ou description courte de la proposition.
    /// @param voteCount Nombre total de votes reçus par la proposition.
    struct Proposal {
        string name;
        uint256 voteCount;
    }

    /// @notice Durée par défaut du vote en minutes.
    uint256 public constant DEFAULT_DURATION_MINUTES = 10000;

    /// @notice Date limite du vote sous forme de timestamp Unix.
    uint256 public deadline;

    /// @notice Indique si le vote a été fermé officiellement.
    bool public votingClosed;

    /// @dev Liste privée des propositions.
    Proposal[] private proposals;

    /// @notice Indique si une adresse a déjà voté.
    mapping(address => bool) public hasVoted;

    /// @notice Émis lorsqu'une nouvelle proposition est ajoutée.
    /// @param proposalId Identifiant de la proposition ajoutée.
    /// @param name Nom de la proposition ajoutée.
    event ProposalAdded(uint256 indexed proposalId, string name);

    /// @notice Émis lorsqu'un utilisateur vote.
    /// @param voter Adresse de l'utilisateur ayant voté.
    /// @param proposalId Identifiant de la proposition choisie.
    event Voted(address indexed voter, uint256 indexed proposalId);

    /// @notice Émis lorsque le vote est officiellement fermé.
    /// @param winningProposalId Identifiant de la proposition gagnante.
    /// @param winningProposalName Nom de la proposition gagnante.
    /// @param voteCount Nombre de votes reçus par la proposition gagnante.
    event VotingClosed(uint256 winningProposalId, string winningProposalName, uint256 voteCount);

    /// @dev Vérifie que le vote est encore ouvert.
    modifier votingIsOpen() {
        require(!votingClosed, "Voting is already closed");
        require(block.timestamp < deadline, "Voting deadline has passed");
        _;
    }

    /// @notice Initialise le contrat avec quatre propositions par défaut et une deadline.
    /// @dev Le propriétaire initial est l'adresse qui déploie le contrat.
    constructor() Ownable(msg.sender) {
        deadline = block.timestamp + (DEFAULT_DURATION_MINUTES * 1 minutes);

        string[4] memory proposalNames = [
            "Augmenter le budget communautaire",
            "Lancer un programme educatif",
            "Soutenir une association locale",
            "Investir dans la securite"
        ];

        for (uint256 i = 0; i < proposalNames.length; i++) {
            _addProposal(proposalNames[i]);
        }
    }

    /// @notice Ajoute une nouvelle proposition au vote.
    /// @dev Fonction réservée au propriétaire du contrat grâce à OpenZeppelin Ownable.
    /// @param name Nom ou description courte de la proposition à ajouter.
    function addProposal(string calldata name) external onlyOwner votingIsOpen {
        _addProposal(name);
    }

    /// @notice Permet à une adresse de voter une seule fois pour une proposition.
    /// @param proposalId Identifiant de la proposition choisie.
    function vote(uint256 proposalId) external votingIsOpen {
        require(!hasVoted[msg.sender], "You have already voted");
        require(proposalId < proposals.length, "Invalid proposal id");

        hasVoted[msg.sender] = true;
        proposals[proposalId].voteCount += 1;

        emit Voted(msg.sender, proposalId);
    }

    /// @notice Ferme officiellement le vote après la deadline.
    /// @dev Appelable par n'importe qui après la deadline pour garder un fonctionnement décentralisé.
    function closeVoting() external {
        require(!votingClosed, "Voting is already closed");
        require(block.timestamp >= deadline, "Deadline not reached yet");

        votingClosed = true;

        (uint256 winnerId, string memory winnerName, uint256 winnerVotes) = getWinner();
        emit VotingClosed(winnerId, winnerName, winnerVotes);
    }

    /// @notice Retourne une proposition par son identifiant.
    /// @param proposalId Identifiant de la proposition recherchée.
    /// @return name Nom de la proposition.
    /// @return voteCount Nombre de votes reçus par la proposition.
    function getProposal(uint256 proposalId)
        external
        view
        returns (string memory name, uint256 voteCount)
    {
        require(proposalId < proposals.length, "Invalid proposal id");
        Proposal memory proposal = proposals[proposalId];
        return (proposal.name, proposal.voteCount);
    }

    /// @notice Retourne le nombre total de propositions.
    /// @return proposalCount Nombre total de propositions disponibles.
    function getProposalCount() external view returns (uint256 proposalCount) {
        return proposals.length;
    }

    /// @notice Retourne toutes les propositions avec leurs votes.
    /// @return allProposals Liste complète des propositions.
    function getAllProposals() external view returns (Proposal[] memory allProposals) {
        return proposals;
    }

    /// @notice Retourne le gagnant actuel ou final.
    /// @dev Revert si aucun vote n'a été émis ou si plusieurs propositions sont à égalité.
    /// @return winningProposalId Identifiant de la proposition gagnante.
    /// @return winningProposalName Nom de la proposition gagnante.
    /// @return winningVoteCount Nombre de votes de la proposition gagnante.
    function getWinner()
        public
        view
        returns (
            uint256 winningProposalId,
            string memory winningProposalName,
            uint256 winningVoteCount
        )
    {
        uint256 maxVotes = 0;
        uint256 winnerId = 0;

        for (uint256 i = 0; i < proposals.length; i++) {
            if (proposals[i].voteCount > maxVotes) {
                maxVotes = proposals[i].voteCount;
                winnerId = i;
            }
        }

        require(maxVotes > 0, "No votes have been cast yet");

        for (uint256 j = 0; j < proposals.length; j++) {
            if (j != winnerId && proposals[j].voteCount == maxVotes) {
                revert("Tie detected: no single winner");
            }
        }

        return (winnerId, proposals[winnerId].name, maxVotes);
    }

    /// @notice Vérifie si le vote est encore ouvert.
    /// @return True si le vote est ouvert, sinon false.
    function isVotingOpen() external view returns (bool) {
        return !votingClosed && block.timestamp < deadline;
    }

    /// @notice Retourne le temps restant avant la deadline.
    /// @return remainingTime Temps restant en secondes, ou 0 si la deadline est dépassée.
    function getRemainingTime() external view returns (uint256 remainingTime) {
        if (block.timestamp >= deadline) {
            return 0;
        }
        return deadline - block.timestamp;
    }

    /// @dev Ajoute une proposition dans le tableau et émet l'événement ProposalAdded.
    /// @param name Nom ou description courte de la proposition.
    function _addProposal(string memory name) private {
        require(bytes(name).length > 0, "Proposal name cannot be empty");

        proposals.push(Proposal({name: name, voteCount: 0}));
        emit ProposalAdded(proposals.length - 1, name);
    }
}
