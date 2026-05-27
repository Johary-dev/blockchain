// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title DecentralizedVoting
/// @author Tantely, Johary, Jordie, Aldonis
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

}
