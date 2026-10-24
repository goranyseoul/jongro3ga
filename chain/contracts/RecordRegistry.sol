// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IVerifier} from "./AppendVerifier.sol";

/// @notice Public anchor for private procedure charts.
/// Stores only a pseudonymous subjectId -> chart commitment. No chart data, no clinic identity,
/// no procedure type ever touches the chain. Every update must carry a valid ZK append proof:
/// the new chart is the old chart plus exactly one record, dated today (no backdating, no deletion).
contract RecordRegistry {
    IVerifier public immutable appendVerifier;
    /// Platform relayer: submits on behalf of clinics so clinic addresses never appear on-chain.
    address public immutable relayer;
    /// Length of one "day" in seconds. 86400 in production; a short value lets a demo deployment
    /// age records in minutes instead of months.
    uint256 public immutable secondsPerDay;

    mapping(bytes32 => bytes32) public commitmentOf;
    mapping(bytes32 => uint64) public versionOf;

    event RecordAppended(bytes32 indexed subjectId, bytes32 commitment, uint64 version, uint32 day);

    error NotRelayer();
    error BadDate();
    error InvalidProof();

    constructor(IVerifier _appendVerifier, address _relayer, uint256 _secondsPerDay) {
        appendVerifier = _appendVerifier;
        relayer = _relayer;
        secondsPerDay = _secondsPerDay;
    }

    function today() public view returns (uint32) {
        return uint32(block.timestamp / secondsPerDay);
    }

    function append(
        bytes32 subjectId,
        bytes32 newCommitment,
        bytes32 recordHash,
        uint32 day,
        bytes calldata proof
    ) external {
        if (msg.sender != relayer) revert NotRelayer();
        // record must be dated today (or yesterday, to tolerate UTC boundary)
        uint32 t = today();
        if (day != t && day + 1 != t) revert BadDate();

        bytes32[] memory publicInputs = new bytes32[](4);
        publicInputs[0] = commitmentOf[subjectId]; // 0 for a new subject -> circuit forces empty chart
        publicInputs[1] = newCommitment;
        publicInputs[2] = recordHash;
        publicInputs[3] = bytes32(uint256(day));
        if (!appendVerifier.verify(proof, publicInputs)) revert InvalidProof();

        commitmentOf[subjectId] = newCommitment;
        uint64 v = ++versionOf[subjectId];
        emit RecordAppended(subjectId, newCommitment, v, day);
    }
}
