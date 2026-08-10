// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface IAuraBuildEscrow {
    function homeowner() external view returns (address);
}

/// @title AuraBuildRegistry
/// @notice ERC-721 where each token anchors one home build as an RWA record:
///         design hash, budget hash, escrow address, and lifecycle status.
///         Minting/updating is limited to the linked escrow's homeowner or a registrar.
contract AuraBuildRegistry is ERC721, Ownable {
    /// @notice Canonical build lifecycle, in order:
    ///         Designed (0) -> Funded (1) -> UnderConstruction (2) -> Complete (3).
    ///         This enum is the vocabulary of record — every doc and UI surface must use
    ///         these exact names and indices. (Not "Reserved/Contracted": that older
    ///         wording is superseded by this contract.)
    enum BuildStatus {
        Designed,
        Funded,
        UnderConstruction,
        Complete
    }

    struct BuildRecord {
        bytes32 designHash;
        bytes32 budgetHash;
        address escrow;
        BuildStatus status;
    }

    error ZeroAddress();
    error NotAuthorized();
    error UnknownToken();

    event RegistrarSet(address indexed registrar, bool allowed);
    event BuildMinted(
        uint256 indexed tokenId, address indexed escrow, bytes32 designHash, bytes32 budgetHash
    );
    event BuildStatusUpdated(uint256 indexed tokenId, BuildStatus status);
    event BuildURIUpdated(uint256 indexed tokenId, string uri);

    mapping(uint256 => BuildRecord) public records;
    mapping(address => bool) public registrars;
    mapping(uint256 => string) private _tokenURIs;
    uint256 public nextTokenId;

    constructor() ERC721("Aura Build Registry", "AURA") Ownable(msg.sender) {}

    function setRegistrar(address registrar, bool allowed) external onlyOwner {
        if (registrar == address(0)) revert ZeroAddress();
        registrars[registrar] = allowed;
        emit RegistrarSet(registrar, allowed);
    }

    /// @dev Authorized = registrar, or the homeowner of the escrow tied to the record.
    function _requireAuthorized(address escrow) internal view {
        if (registrars[msg.sender]) return;
        if (escrow != address(0) && IAuraBuildEscrow(escrow).homeowner() == msg.sender) return;
        revert NotAuthorized();
    }

    function mint(
        address to,
        bytes32 designHash,
        bytes32 budgetHash,
        address escrow,
        string calldata uri
    ) external returns (uint256 tokenId) {
        _requireAuthorized(escrow);
        tokenId = nextTokenId++;
        _safeMint(to, tokenId);
        records[tokenId] =
            BuildRecord({designHash: designHash, budgetHash: budgetHash, escrow: escrow, status: BuildStatus.Designed});
        _tokenURIs[tokenId] = uri;
        emit BuildMinted(tokenId, escrow, designHash, budgetHash);
    }

    function updateStatus(uint256 tokenId, BuildStatus status) external {
        _requireExists(tokenId);
        _requireAuthorized(records[tokenId].escrow);
        records[tokenId].status = status;
        emit BuildStatusUpdated(tokenId, status);
    }

    function setTokenURI(uint256 tokenId, string calldata uri) external {
        _requireExists(tokenId);
        _requireAuthorized(records[tokenId].escrow);
        _tokenURIs[tokenId] = uri;
        emit BuildURIUpdated(tokenId, uri);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireExists(tokenId);
        return _tokenURIs[tokenId];
    }

    function _requireExists(uint256 tokenId) internal view {
        if (_ownerOf(tokenId) == address(0)) revert UnknownToken();
    }
}
