// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/**
 * @title ArcTaskEscrow
 * @notice Pre-funded USDC task/gig escrow for Arc.
 *
 * Lifecycle:
 *   Open -> Assigned -> Submitted -> Resolved (approve / 4-day auto-release)
 *                    \-> Disputed  -> Resolved (admin split or timeout split)
 *   Open     -> Cancelled (creator cancels, full refund)
 *   Assigned -> Cancelled (worker missed delivery deadline, creator reclaims)
 *
 * Design notes:
 *  - The owner ("admin") should be a multisig. It can only split a disputed
 *    job's escrow; it can NEVER withdraw arbitrary funds (no rescue function).
 *  - Pausing only blocks NEW jobs. Existing jobs can always settle.
 *  - Long text (proof URLs, deliverables, complaints, metadata) lives in events,
 *    not storage, to save gas. Index events off-chain for the UI.
 *  - UNAUDITED. Use the per-job deposit cap while testing on mainnet.
 */
contract ArcTaskEscrow is Ownable2Step, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ---------------------------------------------------------------------
    // Types
    // ---------------------------------------------------------------------

    enum JobStatus { None, Open, Assigned, Submitted, Disputed, Resolved, Cancelled }

    enum SettleType {
        Approved,        // creator approved the work early
        AutoRelease,     // 4-day window elapsed with no action
        DisputeResolved, // admin decided the split
        DisputeTimeout,  // admin never acted, default 50/50
        Reclaimed,       // worker missed delivery deadline
        Cancelled        // creator cancelled an Open job
    }

    struct Job {
        address creator;
        address worker;
        JobStatus status;
        uint64 deliveryDuration;    // seconds the worker gets after being approved
        uint64 deliveryDeadline;    // set on approval
        uint64 submissionTimestamp; // set on submit
        uint64 disputedAt;          // set on complaint
        address complainant;        // who logged the complaint
        uint256 reward;             // USDC (token decimals)
        uint256 bond;               // dispute bond held for the complainant
    }

    // ---------------------------------------------------------------------
    // Constants & config
    // ---------------------------------------------------------------------

    uint64 public constant AUTO_RELEASE_DELAY = 4 days;
    uint64 public constant ADMIN_TIMEOUT = 14 days;
    uint64 public constant MIN_DELIVERY = 1 days;
    uint64 public constant MAX_DELIVERY = 90 days;
    uint256 public constant DISPUTE_BOND_BPS = 500; // 5% of reward
    uint256 public constant MAX_TEXT_LENGTH = 512;  // bytes, per string

    IERC20 public immutable usdc;

    uint256 public minReward;
    uint256 public maxReward;   // per-job deposit cap
    uint256 public minBond;     // floor for dispute bond

    uint256 public jobCount;

    mapping(uint256 => Job) public jobs;
    mapping(uint256 => mapping(address => bool)) public hasApplied;

    // ---------------------------------------------------------------------
    // Events (the front end derives all reputation stats from these)
    // ---------------------------------------------------------------------

    event JobCreated(
        uint256 indexed jobId,
        address indexed creator,
        uint256 reward,
        uint64 deliveryDuration,
        string metadataUri
    );
    event JobApplication(uint256 indexed jobId, address indexed worker, string proofUrl);
    event JobAssigned(uint256 indexed jobId, address indexed worker, uint64 deliveryDeadline);
    event WorkerWithdrew(uint256 indexed jobId, address indexed worker);
    event WorkSubmitted(
        uint256 indexed jobId,
        address indexed worker,
        string deliverablesUrl,
        uint64 submissionTimestamp
    );
    event ComplaintLogged(
        uint256 indexed jobId,
        address indexed complainant,
        string reason,
        uint256 bond
    );
    /// @dev Emitted for EVERY terminal outcome so stats (earned, completion rate) are complete.
    event JobSettled(
        uint256 indexed jobId,
        address indexed creator,
        address indexed worker,
        uint256 workerAmount,
        uint256 creatorAmount,
        SettleType settleType
    );
    event BondSettled(uint256 indexed jobId, address indexed recipient, uint256 amount);
    event LimitsUpdated(uint256 minReward, uint256 maxReward, uint256 minBond);

    // ---------------------------------------------------------------------
    // Constructor
    // ---------------------------------------------------------------------

    /**
     * @param _usdc         ERC-20 USDC address on Arc (verify in Arc docs).
     * @param _admin        Admin address (use a multisig on mainnet).
     * @param _minReward    Min reward, in token units (e.g. 1e6 = 1 USDC if 6 decimals).
     * @param _maxReward    Per-job deposit cap, in token units.
     * @param _minBond      Minimum dispute bond, in token units.
     */
    constructor(
        address _usdc,
        address _admin,
        uint256 _minReward,
        uint256 _maxReward,
        uint256 _minBond
    ) Ownable(_admin) {
        require(_usdc != address(0), "Zero USDC address");
        usdc = IERC20(_usdc);
        _setLimits(_minReward, _maxReward, _minBond);
    }

    // ---------------------------------------------------------------------
    // Creator: post / cancel
    // ---------------------------------------------------------------------

    /// @notice Post a job and lock 100% of the reward in escrow.
    /// @dev Caller must first approve this contract to spend `reward` USDC.
    function createJob(
        uint256 reward,
        uint64 deliveryDuration,
        string calldata metadataUri
    ) external whenNotPaused nonReentrant returns (uint256 jobId) {
        require(reward > 0, "Zero reward");
        require(reward >= minReward, "Below min reward");
        require(reward <= maxReward, "Above deposit cap");
        require(
            deliveryDuration >= MIN_DELIVERY && deliveryDuration <= MAX_DELIVERY,
            "Bad delivery duration"
        );
        _checkLength(metadataUri);

        jobId = ++jobCount;

        Job storage job = jobs[jobId];
        job.creator = msg.sender;
        job.status = JobStatus.Open;
        job.deliveryDuration = deliveryDuration;
        job.reward = reward;

        usdc.safeTransferFrom(msg.sender, address(this), reward);

        emit JobCreated(jobId, msg.sender, reward, deliveryDuration, metadataUri);
    }

    /// @notice Cancel an Open job (no worker approved yet) and get a full refund.
    function cancelJob(uint256 jobId) external nonReentrant {
        Job storage job = jobs[jobId];
        require(msg.sender == job.creator, "Not creator");
        require(job.status == JobStatus.Open, "Not open");

        job.status = JobStatus.Cancelled;
        _settle(jobId, job, 0, job.reward, SettleType.Cancelled);
    }

    /// @notice Creator reclaims funds if the assigned worker missed the delivery deadline.
    function reclaimStaleJob(uint256 jobId) external nonReentrant {
        Job storage job = jobs[jobId];
        require(msg.sender == job.creator, "Not creator");
        require(job.status == JobStatus.Assigned, "Not assigned");
        require(block.timestamp > job.deliveryDeadline, "Deadline not passed");

        job.status = JobStatus.Cancelled;
        _settle(jobId, job, 0, job.reward, SettleType.Reclaimed);
    }

    // ---------------------------------------------------------------------
    // Worker: apply / withdraw / submit
    // ---------------------------------------------------------------------

    /// @notice Apply with a proof-of-work link. Stored in an event only.
    function applyForJob(uint256 jobId, string calldata proofUrl) external {
        Job storage job = jobs[jobId];
        require(job.status == JobStatus.Open, "Job not open");
        require(msg.sender != job.creator, "Creator cannot apply");
        require(!hasApplied[jobId][msg.sender], "Already applied");
        _checkLength(proofUrl);

        hasApplied[jobId][msg.sender] = true;
        emit JobApplication(jobId, msg.sender, proofUrl);
    }

    /// @notice Assigned worker backs out; job reopens for other applicants.
    function withdrawFromJob(uint256 jobId) external {
        Job storage job = jobs[jobId];
        require(msg.sender == job.worker, "Not assigned worker");
        require(job.status == JobStatus.Assigned, "Not assigned");

        job.worker = address(0);
        job.deliveryDeadline = 0;
        job.status = JobStatus.Open;

        emit WorkerWithdrew(jobId, msg.sender);
    }

    /// @notice Submit deliverables. Must be before the delivery deadline. Starts the 4-day clock.
    function submitWork(uint256 jobId, string calldata deliverablesUrl) external {
        Job storage job = jobs[jobId];
        require(msg.sender == job.worker, "Not assigned worker");
        require(job.status == JobStatus.Assigned, "Invalid status");
        require(block.timestamp <= job.deliveryDeadline, "Deadline passed");
        _checkLength(deliverablesUrl);

        job.status = JobStatus.Submitted;
        job.submissionTimestamp = uint64(block.timestamp);

        emit WorkSubmitted(jobId, msg.sender, deliverablesUrl, uint64(block.timestamp));
    }

    // ---------------------------------------------------------------------
    // Creator: approve worker / approve work
    // ---------------------------------------------------------------------

    /// @notice Lock the job to an applicant. Delivery clock starts now.
    function approveWorker(uint256 jobId, address worker) external {
        Job storage job = jobs[jobId];
        require(msg.sender == job.creator, "Not creator");
        require(job.status == JobStatus.Open, "Not open");
        require(hasApplied[jobId][worker], "Worker did not apply");
        require(worker != job.creator, "Creator cannot be worker");

        job.worker = worker;
        job.status = JobStatus.Assigned;
        job.deliveryDeadline = uint64(block.timestamp) + job.deliveryDuration;

        emit JobAssigned(jobId, worker, job.deliveryDeadline);
    }

    /// @notice Approve submitted work for an instant 100% payout.
    function approveWork(uint256 jobId) external nonReentrant {
        Job storage job = jobs[jobId];
        require(msg.sender == job.creator, "Not creator");
        require(job.status == JobStatus.Submitted, "Not submitted");

        job.status = JobStatus.Resolved;
        _settle(jobId, job, job.reward, 0, SettleType.Approved);
    }

    // ---------------------------------------------------------------------
    // Auto-release
    // ---------------------------------------------------------------------

    /// @notice Anyone can trigger payout once the 4-day window passes with no dispute.
    function claimAutoRelease(uint256 jobId) external nonReentrant {
        Job storage job = jobs[jobId];
        require(job.status == JobStatus.Submitted, "Not submitted");
        require(
            block.timestamp >= job.submissionTimestamp + AUTO_RELEASE_DELAY,
            "4-day window active"
        );

        job.status = JobStatus.Resolved;
        _settle(jobId, job, job.reward, 0, SettleType.AutoRelease);
    }

    // ---------------------------------------------------------------------
    // Disputes
    // ---------------------------------------------------------------------

    /// @notice Bond required to open a dispute on a job with this reward.
    function disputeBondFor(uint256 reward) public view returns (uint256) {
        uint256 pct = (reward * DISPUTE_BOND_BPS) / 10_000;
        return pct > minBond ? pct : minBond;
    }

    /**
     * @notice Either party can dispute. Requires a bond (refunded if the complainant
     *         wins at least half the escrow, otherwise paid to the other party).
     * @dev While Submitted, disputes must be logged BEFORE the auto-release time so a
     *      creator can't front-run claimAutoRelease() at the last second.
     */
    function logComplaint(uint256 jobId, string calldata reason) external nonReentrant {
        Job storage job = jobs[jobId];
        require(msg.sender == job.creator || msg.sender == job.worker, "Unauthorized");
        require(
            job.status == JobStatus.Assigned || job.status == JobStatus.Submitted,
            "Cannot dispute"
        );
        if (job.status == JobStatus.Submitted) {
            require(
                block.timestamp < job.submissionTimestamp + AUTO_RELEASE_DELAY,
                "Auto-release window closed"
            );
        }
        _checkLength(reason);

        uint256 bond = disputeBondFor(job.reward);

        job.status = JobStatus.Disputed;
        job.complainant = msg.sender;
        job.disputedAt = uint64(block.timestamp);
        job.bond = bond;

        usdc.safeTransferFrom(msg.sender, address(this), bond);

        emit ComplaintLogged(jobId, msg.sender, reason, bond);
    }

    /// @notice Admin (multisig) splits the escrow. Split must equal the reward exactly.
    function resolveDispute(
        uint256 jobId,
        uint256 workerPayout,
        uint256 creatorRefund
    ) external onlyOwner nonReentrant {
        Job storage job = jobs[jobId];
        require(job.status == JobStatus.Disputed, "Not disputed");
        require(workerPayout + creatorRefund == job.reward, "Invalid split");

        job.status = JobStatus.Resolved;

        uint256 complainantShare = job.complainant == job.creator ? creatorRefund : workerPayout;
        bool complainantPrevailed = complainantShare * 2 >= job.reward;

        _settle(jobId, job, workerPayout, creatorRefund, SettleType.DisputeResolved);
        _settleBond(jobId, job, complainantPrevailed);
    }

    /// @notice If admin never acts, anyone can force a default 50/50 split after ADMIN_TIMEOUT.
    ///         The complainant's bond is returned (no fault determined).
    function resolveExpiredDispute(uint256 jobId) external nonReentrant {
        Job storage job = jobs[jobId];
        require(job.status == JobStatus.Disputed, "Not disputed");
        require(block.timestamp >= job.disputedAt + ADMIN_TIMEOUT, "Admin window active");

        job.status = JobStatus.Resolved;

        uint256 workerPayout = job.reward / 2;
        uint256 creatorRefund = job.reward - workerPayout;

        _settle(jobId, job, workerPayout, creatorRefund, SettleType.DisputeTimeout);
        _settleBond(jobId, job, true);
    }

    // ---------------------------------------------------------------------
    // Admin config (cannot touch escrowed funds)
    // ---------------------------------------------------------------------

    function setLimits(uint256 _minReward, uint256 _maxReward, uint256 _minBond) external onlyOwner {
        _setLimits(_minReward, _maxReward, _minBond);
    }

    /// @notice Pause NEW job creation only. Everything else keeps working.
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ---------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------

    function _setLimits(uint256 _minReward, uint256 _maxReward, uint256 _minBond) private {
        require(_minReward > 0 && _minReward <= _maxReward, "Bad reward limits");
        require(_minBond > 0, "Zero min bond");
        minReward = _minReward;
        maxReward = _maxReward;
        minBond = _minBond;
        emit LimitsUpdated(_minReward, _maxReward, _minBond);
    }

    /// @dev Caller must set the new status BEFORE calling (checks-effects-interactions).
    function _settle(
        uint256 jobId,
        Job storage job,
        uint256 workerAmount,
        uint256 creatorAmount,
        SettleType how
    ) private {
        if (workerAmount > 0) usdc.safeTransfer(job.worker, workerAmount);
        if (creatorAmount > 0) usdc.safeTransfer(job.creator, creatorAmount);
        emit JobSettled(jobId, job.creator, job.worker, workerAmount, creatorAmount, how);
    }

    function _settleBond(uint256 jobId, Job storage job, bool toComplainant) private {
        uint256 bond = job.bond;
        if (bond == 0) return;
        job.bond = 0;

        address recipient = job.complainant;
        if (!toComplainant) {
            recipient = job.complainant == job.creator ? job.worker : job.creator;
        }

        usdc.safeTransfer(recipient, bond);
        emit BondSettled(jobId, recipient, bond);
    }

    function _checkLength(string calldata s) private pure {
        require(bytes(s).length <= MAX_TEXT_LENGTH, "Text too long");
    }
}
