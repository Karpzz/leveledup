import { LAMPORTS_PER_SOL, type PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { getTokenMetadata } from "./tokenMetadata";
import { Connection } from "@solana/web3.js";

/**
 * Get the token balances of a Solana wallet
 * @param token_address - Optional SPL token mint address. If not provided, returns SOL balance
 * @returns Promise resolving to the balance as an object containing sol balance and token balances with their respective mints, symbols, names and decimals
 */
export async function get_token_balance(
  walletAddress: PublicKey,
  heliusConnection: Connection,
  getBalances: boolean = false
): Promise<{
  sol: number;
  tokens: Array<any>;
  [key: string]: any;
}> {
  // Create a new connection with Helius RPC
  const [lamportsBalance, tokenAccountData] = await Promise.all([
    heliusConnection.getBalance(walletAddress),
    heliusConnection.getParsedTokenAccountsByOwner(
      walletAddress,
      {
        programId: TOKEN_PROGRAM_ID,
      },
    ),
  ]);

  const removedZeroBalance = tokenAccountData.value.filter(
    (v) => v.account.data.parsed.info.tokenAmount.uiAmount !== 0,
  );
  
  const tokenBalances = await Promise.all(
    removedZeroBalance.map(async (v) => {
      const mint = v.account.data.parsed.info.mint;
      if (!getBalances) {
        return {
          tokenAddress: mint,
          name: "Unknown Token",
          symbol: "???",
          balance: v.account.data.parsed.info.tokenAmount.uiAmount as number, 
          decimals: v.account.data.parsed.info.tokenAmount.decimals as number,
        };
      }
      
      try {
        const mintInfo = await getTokenMetadata(heliusConnection, mint);
        return {
          tokenAddress: mint,
          name: mintInfo.name ?? "Unknown Token",
          symbol: mintInfo.symbol ?? "???",
          balance: v.account.data.parsed.info.tokenAmount.uiAmount as number,
          decimals: v.account.data.parsed.info.tokenAmount.decimals as number,
        };
      } catch (error) {
        return {
          tokenAddress: mint,
          name: "Unavailable (Rate Limited)",
          symbol: "...",
          balance: v.account.data.parsed.info.tokenAmount.uiAmount as number,
          decimals: v.account.data.parsed.info.tokenAmount.decimals as number,
        };
      }
    }),
  );

  const solBalance = lamportsBalance / LAMPORTS_PER_SOL;

  return {
    sol: solBalance,
    tokens: tokenBalances,
  };
}
