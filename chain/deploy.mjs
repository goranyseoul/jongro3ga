// Deploys HonkVerifier (+ linked lib) and RecordRegistry to Base Sepolia.
// Usage: node --env-file=.env deploy.mjs [secondsPerDay=60]
// The deployer key doubles as the platform relayer for the hackathon.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createPublicClient, createWalletClient, http, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { deployArtifact } from './deploy-utils.mjs';

const secondsPerDay = BigInt(process.argv[2] ?? 60);
const account = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY);
const transport = http(process.env.BASE_SEPOLIA_RPC);
const pub = createPublicClient({ chain: baseSepolia, transport });
const wallet = createWalletClient({ account, chain: baseSepolia, transport });
const art = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));

console.log('deployer', account.address, formatEther(await pub.getBalance({ address: account.address })), 'ETH');
const verifier = await deployArtifact(wallet, pub, art('./build/HonkVerifier.json'));
const registry = await deployArtifact(wallet, pub, art('./build/RecordRegistry.json'), [verifier, account.address, secondsPerDay]);
const out = { chainId: baseSepolia.id, verifier, registry, relayer: account.address, secondsPerDay: Number(secondsPerDay), deployedAt: new Date().toISOString() };
mkdirSync('deployments', { recursive: true });
writeFileSync('deployments/base-sepolia.json', JSON.stringify(out, null, 2) + '\n');
console.log(out);
console.log(`https://sepolia.basescan.org/address/${registry}`);
