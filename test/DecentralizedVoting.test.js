const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("DecentralizedVoting", function () {
  let voting;
  let owner;
  let voter1;
  let voter2;
  let voter3;

  beforeEach(async function () {
    [owner, voter1, voter2, voter3] = await ethers.getSigners();

    const DecentralizedVoting = await ethers.getContractFactory("DecentralizedVoting");
    voting = await DecentralizedVoting.deploy();

    await voting.waitForDeployment();
  });

  it("doit déployer le contrat avec le bon owner", async function () {
    expect(await voting.owner()).to.equal(owner.address);
  });

  it("doit créer 4 propositions au déploiement", async function () {
    const count = await voting.getProposalCount();

    expect(count).to.equal(4);
  });

  it("doit retourner une proposition correctement", async function () {
    const proposal = await voting.getProposal(0);

    expect(proposal[0]).to.equal("Augmenter le budget communautaire");
    expect(proposal[1]).to.equal(0);
  });

  it("doit permettre à un utilisateur de voter", async function () {
    await voting.connect(voter1).vote(1);

    const proposal = await voting.getProposal(1);

    expect(proposal[1]).to.equal(1);
    expect(await voting.hasVoted(voter1.address)).to.equal(true);
  });

  it("doit émettre un événement après un vote", async function () {
    await expect(voting.connect(voter1).vote(2))
      .to.emit(voting, "Voted")
      .withArgs(voter1.address, 2);
  });

  it("ne doit pas permettre de voter deux fois", async function () {
    await voting.connect(voter1).vote(1);

    await expect(voting.connect(voter1).vote(2))
      .to.be.revertedWith("You have already voted");
  });

  it("ne doit pas permettre de voter pour une proposition invalide", async function () {
    await expect(voting.connect(voter1).vote(99))
      .to.be.revertedWith("Invalid proposal id");
  });

  it("ne doit pas fermer le vote avant la deadline", async function () {
    await expect(voting.closeVoting())
      .to.be.revertedWith("Deadline not reached yet");
  });

  it("doit retourner le gagnant quand il y a un seul gagnant", async function () {
    await voting.connect(voter1).vote(0);
    await voting.connect(voter2).vote(0);
    await voting.connect(voter3).vote(1);

    const winner = await voting.getWinner();

    expect(winner[0]).to.equal(0);
    expect(winner[1]).to.equal("Augmenter le budget communautaire");
    expect(winner[2]).to.equal(2);
  });

  it("doit refuser de retourner un gagnant s'il n'y a aucun vote", async function () {
    await expect(voting.getWinner())
      .to.be.revertedWith("No votes have been cast yet");
  });

  it("doit refuser de retourner un gagnant en cas d'égalité", async function () {
    await voting.connect(voter1).vote(0);
    await voting.connect(voter2).vote(1);

    await expect(voting.getWinner())
      .to.be.revertedWith("Tie detected: no single winner");
  });

  it("doit fermer le vote après la deadline", async function () {
    await voting.connect(voter1).vote(0);

    const deadline = await voting.deadline();

    await time.increaseTo(deadline);

    await expect(voting.closeVoting())
      .to.emit(voting, "VotingClosed");

    expect(await voting.votingClosed()).to.equal(true);
  });

  it("ne doit plus permettre de voter après la deadline", async function () {
    const deadline = await voting.deadline();

    await time.increaseTo(deadline);

    await expect(voting.connect(voter1).vote(0))
      .to.be.revertedWith("Voting deadline has passed");
  });
});