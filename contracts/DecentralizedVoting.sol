// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title DecentralizedVoting
/// @author Tantely, Johary, Sabrina, Aldonis
/// @notice Contrat de vote décentralisé : propositions on-chain, un vote par adresse, clôture par deadline.
///

contract DecentralizedVoting {
    struct Proposal {
        string  name;
        uint256 voteCount;
    }

    address public owner;
    uint256 public deadline;
    bool    public votingClosed;

    Proposal[]                            private proposals;
    mapping(address => bool)              public  hasVoted;

    event ProposalAdded(uint256 indexed proposalId, string name);
    event Voted(address indexed voter, uint256 indexed proposalId);
    event VotingClosed(uint256 winningProposalId, string winningProposalName, uint256 voteCount);

    modifier votingIsOpen() {
        require(!votingClosed, "Voting is already closed");
        require(block.timestamp < deadline, "Voting deadline has passed");
        _;
    }

    uint256 public constant DEFAULT_DURATION_MINUTES = 10000;

    constructor() {
        owner = msg.sender;
        uint256 durationInMinutes = DEFAULT_DURATION_MINUTES;
        deadline = block.timestamp + (durationInMinutes * 1 minutes);

        string[4] memory proposalNames = [
            "Augmenter le budget communautaire",
            "Lancer un programme educatif",
            "Soutenir une association locale",
            "Investir dans la securite"
        ];

        for (uint256 i = 0; i < proposalNames.length; i++) {
            proposals.push(Proposal({name: proposalNames[i], voteCount: 0}));
            emit ProposalAdded(i, proposalNames[i]);
        }
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
    /// @dev Appelable par n'importe qui après la deadline (décentralisé).
    function closeVoting() external {
        require(!votingClosed, "Voting is already closed");
        require(block.timestamp >= deadline, "Deadline not reached yet");

        votingClosed = true;

        (uint256 winnerId, string memory winnerName, uint256 winnerVotes) = getWinner();
        emit VotingClosed(winnerId, winnerName, winnerVotes);
    }

    /// @notice Retourne une proposition par son identifiant.
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
    function getProposalCount() external view returns (uint256) {
        return proposals.length;
    }

    /// @notice Retourne toutes les propositions avec leurs votes.
    function getAllProposals() external view returns (Proposal[] memory) {
        return proposals;
    }

    /// @notice Retourne le gagnant actuel ou final.
    /// @dev Revert si aucun vote n'a été émis ou si plusieurs propositions sont à égalité.
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
    function isVotingOpen() external view returns (bool) {
        return !votingClosed && block.timestamp < deadline;
    }

    /// @notice Retourne le temps restant avant la deadline (0 si écoulée).
    function getRemainingTime() external view returns (uint256) {
        if (block.timestamp >= deadline) {
            return 0;
        }
        return deadline - block.timestamp;
    }

}
