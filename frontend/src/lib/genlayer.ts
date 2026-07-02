import { createClient } from "genlayer-js";
import { localnet, studionet, testnetAsimov, testnetBradbury } from "genlayer-js/chains";
import { ExecutionResult, TransactionStatus } from "genlayer-js/types";

// Define supported chains
const chains = {
  localnet,
  studionet,
  testnetAsimov,
  testnetBradbury
};

type ChainName = keyof typeof chains;

// Environment config values
const getEnvVal = (key: string, fallback: string) => {
  if (typeof process !== "undefined" && process.env && process.env[key]) {
    return process.env[key] as string;
  }
  return fallback;
};

const defaultChain: ChainName = (getEnvVal("NEXT_PUBLIC_NETWORK", "studionet") as ChainName) || "studionet";
const customRpcEndpoint = getEnvVal("NEXT_PUBLIC_GENLAYER_RPC", "");

// Create the GenLayer JS Client
const genClient = createClient({
  chain: chains[defaultChain] ?? testnetAsimov,
  ...(customRpcEndpoint ? { endpoint: customRpcEndpoint } : {})
});

export interface Web3Result {
  success: boolean;
  data?: any;
  hash?: string;
  error?: string;
}

// Request browser wallet account connection
export async function connectWallet(): Promise<Web3Result> {
  if (typeof window === "undefined" || !window.ethereum) {
    return { success: false, error: "MetaMask or Web3 wallet extension not detected." };
  }
  try {
    const addresses = await window.ethereum.request({
      method: "eth_requestAccounts",
      params: []
    }) as string[];
    return { success: true, data: addresses[0] };
  } catch (err: any) {
    return { success: false, error: err?.message || "User denied account connection." };
  }
}

// Read state from smart contract view methods
export async function readContract(
  functionName: string,
  args: any[] = [],
  contractAddress: string
): Promise<Web3Result> {
  try {
    if (!contractAddress || contractAddress === "0x0000000000000000000000000000000000000000") {
      return { success: false, error: "Renovation contract address not configured." };
    }
    const result = await (genClient as any).readContract({
      address: contractAddress,
      functionName,
      args
    });
    return { success: true, data: result };
  } catch (err: any) {
    return { success: false, error: err?.message || "Read transaction failed." };
  }
}

// Execute state-mutating transaction writes
export async function writeContract(
  functionName: string,
  args: any[] = [],
  contractAddress: string
): Promise<Web3Result> {
  if (typeof window === "undefined" || !window.ethereum) {
    return { success: false, error: "Browser wallet provider required for writing transactions." };
  }
  try {
    if (!contractAddress || contractAddress === "0x0000000000000000000000000000000000000000") {
      return { success: false, error: "Renovation contract address not configured." };
    }

    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
      params: []
    }) as string[];
    const activeAccount = accounts[0];

    if (!activeAccount) {
      return { success: false, error: "No wallet accounts available." };
    }

    // Initialize custom write client for current session account
    const sessionWriteClient = createClient({
      chain: chains[defaultChain] ?? testnetAsimov,
      ...(customRpcEndpoint ? { endpoint: customRpcEndpoint } : {}),
      provider: window.ethereum,
      account: activeAccount as `0x${string}`
    });

    const txHash = await (sessionWriteClient as any).writeContract({
      address: contractAddress,
      functionName,
      args,
      value: BigInt(0)
    });

    // Wait for the block receipt finalized state
    const receipt = await (sessionWriteClient as any).waitForTransactionReceipt({
      hash: txHash,
      status: TransactionStatus.FINALIZED
    });

    if (receipt.txExecutionResultName === ExecutionResult.FINISHED_WITH_ERROR) {
      return {
        success: false,
        hash: txHash,
        error: "Milestone execution failed inside the virtual machine."
      };
    }

    return {
      success: true,
      hash: txHash,
      data: receipt.txDataDecoded
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Transaction write failed."
    };
  }
}
