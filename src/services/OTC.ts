import { Connection, SystemProgram, LAMPORTS_PER_SOL, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { Db, MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
import { getAccount, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import  bs58 from 'bs58';
import axios from 'axios';
dotenv.config();
import { getOrCreateAssociatedTokenAccount, createTransferInstruction, getMint } from '@solana/spl-token';
import { getTokenMetadata } from '../utils/tokenMetadata';
import { v4 as uuidv4 } from 'uuid';
export class OTCProcessor {
    private static instance: OTCProcessor;
    private intervalId: NodeJS.Timeout | null = null;
    private connection: Connection;
    private client: MongoClient;
    private db!: Db;

    private constructor() {
        this.connection = new Connection(
            `${process.env.RPC_URL}`,
            'confirmed'
        );
        const uri = process.env.MONGODB_URI;
        if (!uri) throw new Error('MONGODB_URI is not defined');
        this.client = new MongoClient(uri);
        this.client.connect().then(() => {
            this.db = this.client.db(process.env.DB_NAME || 'leveledup');
            console.log('OTCProcessor connected to MongoDB');
        });
    }

    static getInstance(): OTCProcessor {
        if (!OTCProcessor.instance) {
            OTCProcessor.instance = new OTCProcessor();
        }
        return OTCProcessor.instance;
    }
    getTokens = async (wallet_address: string) => {
        const response = await axios.get(`https://data.solanatracker.io/wallet/${wallet_address}`, {
            headers: {
                'x-api-key': process.env.SOLANA_TRACKER_API_KEY
            }
        });
        return response.data.tokens;
    }
    private async checkBalances(walletAddress: string): Promise < any > {
      console.log('\nFetching SOL balance and token accounts...');
      const [lamportsBalance, tokenAccountData] = await Promise.all([
        this.connection.getBalance(new PublicKey(walletAddress)),
        this.connection.getParsedTokenAccountsByOwner(
          new PublicKey(walletAddress),
          {
            programId: TOKEN_PROGRAM_ID,
          },
        ),
      ]);
    
      const removedZeroBalance = tokenAccountData.value.filter(
        (v) => v.account.data.parsed.info.tokenAmount.uiAmount !== 0,
      );
    
      console.log(`\nProcessing ${removedZeroBalance.length} non-zero token balances...`);
      
      const tokenBalances = await Promise.all(
        removedZeroBalance.map(async (v) => {
          const mint = v.account.data.parsed.info.mint;
          console.log(`\nFetching metadata for token: ${mint}`);
          
          try {
            const mintInfo = await getTokenMetadata(this.connection, mint);
            console.log('Token metadata response:', {
              name: mintInfo.name,
              symbol: mintInfo.symbol,
              balance: v.account.data.parsed.info.tokenAmount.uiAmount,
            });
            
            return {
              tokenAddress: mint,
              name: mintInfo.name ?? "Unknown Token",
              symbol: mintInfo.symbol ?? "???",
              balance: v.account.data.parsed.info.tokenAmount.uiAmount as number,
              decimals: v.account.data.parsed.info.tokenAmount.decimals as number,
            };
          } catch (error: any) {
            console.log(`Error fetching metadata for ${mint}:`, error.message);
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
      console.log('\nFinal SOL balance:', solBalance);
      console.log('Total tokens processed:', tokenBalances.length);
    
      return {
        sol: solBalance,
        tokens: tokenBalances,
      };
    }

    async processOTCTrades() {

        try {
            const trades = await this.db.collection('otc').find({
                status: {
                    $in: ['awaiting_token', 'awaiting_solana', 'transferring_funds']
                }
            }).toArray();

            for (const trade of trades) {
                // Check if expired
                const isExpired = trade.expiresAt && new Date() > new Date(trade.expiresAt);
                if (isExpired) {
                    await this.db.collection('otc').updateOne({
                        _id: new ObjectId(trade._id)
                    }, {
                        $set: {
                            status: 'expired',
                            updatedAt: new Date()
                        }
                    });
                    continue;
                }

                // Check for token receipt if awaiting token
                if (trade.status === 'awaiting_token') {
                    console.log(`\n🔍 Checking for token receipt on trade ${trade._id}`);
                    const balances = await this.checkBalances(trade.escrowWallet);
                    console.log(balances);
                    const tokenBalance = balances.tokens.find((t: any) =>
                        t.tokenAddress === trade.token.address
                    );

                    if (tokenBalance) {
                        const expectedAmount = parseFloat(trade.token.amount);
                        const receivedAmount = tokenBalance.balance;
                        const tolerance = expectedAmount * 0.05; // 5% tolerance

                        console.log('Token amounts:', {
                            expected: expectedAmount,
                            received: receivedAmount,
                            tolerance: tolerance
                        });

                        if (receivedAmount >= expectedAmount - tolerance) {
                            console.log('✅ Token received! Updating status to awaiting_solana');
                            await this.db.collection('otc').updateOne({
                                _id: new ObjectId(trade._id)
                            }, {
                                $set: {
                                    status: 'awaiting_solana',
                                    tokenReceived: true,
                                    status_message: 'Please send SOL to the escrow wallet',
                                    updatedAt: new Date()
                                }
                            });
                        } else {
                            const amountNeeded = (expectedAmount - tolerance - receivedAmount).toFixed(4);
                            console.log(`⚠️ Insufficient tokens received. Needs ${amountNeeded} more`);
                            await this.db.collection('otc').updateOne({
                                _id: new ObjectId(trade._id)
                            }, {
                                $set: {
                                    status_message: `Please send ${amountNeeded} more tokens to complete the trade`,
                                    updatedAt: new Date()
                                }
                            });
                        }
                    }
                }

                // Check for SOL receipt if awaiting solana
                if (trade.status === 'awaiting_solana') {
                    console.log(`\n🔍 Checking for SOL receipt on trade ${trade._id}`);
                    const balances = await this.checkBalances(trade.escrowWallet);

                    const expectedSol = parseFloat(trade.solana.amount);
                    const receivedSol = balances.sol;
                    const tolerance = expectedSol * 0.05; // 5% tolerance

                    console.log('SOL amounts:', {
                        expected: expectedSol,
                        received: receivedSol,
                        tolerance: tolerance
                    });

                    if (receivedSol >= expectedSol - tolerance) {
                        console.log('✅ SOL received! Updating status to transferring_funds');
                        await this.db.collection('otc').updateOne({
                            _id: new ObjectId(trade._id)
                        }, {
                            $set: {
                                status: 'transferring_funds',
                                solReceived: true,
                                status_message: null,
                                updatedAt: new Date()
                            }
                        });
                    } else {
                        const amountNeeded = (expectedSol - receivedSol).toFixed(4);
                        if (receivedSol > 0) {
                            await this.db.collection('otc').updateOne({
                                _id: new ObjectId(trade._id)
                            }, {
                                $set: {
                                    status_message: `Please send ${amountNeeded} more SOL to complete the trade`,
                                    updatedAt: new Date()
                                }
                            });
                        }
                    }
                }

                // Process transfers if status is trandsferring_funds
                if (trade.status === 'transferring_funds') {
                    console.log(`\n💫 Processing transfers for trade ${trade._id}`);

                    var balances = await this.checkBalances(trade.escrowWallet);
                    const tokenInfo = balances.tokens.find((t: any) => t.tokenAddress === trade.token.address);
                    console.log('Token info:', tokenInfo);
                    var privatekey = new Uint8Array(trade.wallet_details.privateKey.split(",").map(Number));
                    const senderKeypair = Keypair.fromSecretKey(
                        privatekey
                    );
                    try {
                        console.log(`\n💫 Processing token transfer for trade ${trade._id}`);
                        console.log(`Sender keypair: ${senderKeypair.publicKey.toBase58()}`);
                        console.log(`Sender private key base58: ${bs58.encode(privatekey)}`);
  

                        const tokenMint = new PublicKey(trade.token.address); // token token mint
                        const recipientPubkey = new PublicKey(trade.token.recipient); // Recipient wallet
                        const amount = Number(trade.token.amount); // Amount of token to send

                        // Check sender SOL balance
                        const senderSolBalance = await this.connection.getBalance(senderKeypair.publicKey);
                        console.log(`Sender SOL balance: ${senderSolBalance / LAMPORTS_PER_SOL} SOL`);
                        if (senderSolBalance < 0.01 * LAMPORTS_PER_SOL) {
                            await this.db.collection("otc").updateOne({
                                _id: new ObjectId(trade._id)
                            }, {
                                $set: {
                                    status_message: `The escrow wallet needs at least 0.01 SOL, has ${senderSolBalance / LAMPORTS_PER_SOL}`,
                                    updatedAt: new Date()
                                }
                            });
                            console.log(`The escrow wallet needs at least 0.01 SOL, has ${senderSolBalance / LAMPORTS_PER_SOL}`);
                            return;
                        }

                        console.log(`🔍 Checking token token ${trade.token.address}...`);
                        const mintInfo = await getMint(this.connection, tokenMint);
                        const rawAmount = Math.floor(amount * Math.pow(10, mintInfo.decimals))  * 0.98;

                        const senderATA = await getOrCreateAssociatedTokenAccount(
                            this.connection,
                            senderKeypair,
                            tokenMint,
                            senderKeypair.publicKey
                        );
                        const senderAccountInfo = await getAccount(this.connection, senderATA.address);
                        if (Number(senderAccountInfo.amount) < rawAmount) {
                            await this.db.collection("otc").updateOne({
                                _id: new ObjectId(trade._id)
                            }, {
                                $set: {
                                    status_message: `Insufficient Tokens: ${Number(senderAccountInfo.amount)} available, ${rawAmount} needed`,
                                    updatedAt: new Date()
                                }
                            });
                            console.log(`Insufficient Tokens: ${Number(senderAccountInfo.amount)} available, ${rawAmount} needed`);
                            return;
                        }

                        console.log(`🔎 Recipient ATA for ${recipientPubkey.toBase58()}...`);
                        let recipientATA;
                        try {
                            recipientATA = await getOrCreateAssociatedTokenAccount(
                                this.connection,
                                senderKeypair,
                                tokenMint,
                                recipientPubkey
                            );
                            console.log(`Recipient ATA: ${recipientATA.address.toBase58()}`);
                        } catch (e: any) {
                            console.error("❌ Failed to get/create recipient ATA:", e.message);
                        }
                        if (!recipientATA) {
                            console.log("❌ Failed to get/create recipient ATA");
                            return;
                        }
                        // Verify recipient ATA
                        const recipientAccountInfo = await getAccount(this.connection, recipientATA.address);
                        console.log(`Recipient balance: ${Number(recipientAccountInfo.amount) / Math.pow(10, mintInfo.decimals)} Tokens (should be 0 if new)`);

                        const transferInstruction = createTransferInstruction(
                            senderATA.address,
                            recipientATA.address,
                            senderKeypair.publicKey,
                            rawAmount
                        );

                        const transaction = new Transaction().add(transferInstruction);
                        console.log("📤 Sending token transaction...");
                        const signature = await sendAndConfirmTransaction(this.connection, transaction, [senderKeypair]);
                        console.log(`✅ Success! Signature: ${signature}`);

                        await this.db.collection("otc").updateOne({
                            _id: new ObjectId(trade._id)
                        }, {
                            $set: {
                                status: "transferred_funds",
                                tokenTxId: signature,
                                updatedAt: new Date()
                            }
                        });
                        console.log("✅ Trade updated.");
                    } catch (error) {
                        console.error("❌ Error transferring token:", error);
                    }

                    // Send SOL
                    const RENT_EXEMPTION = 2049280; // ~0.002 SOL in lamports
                    balances = await this.checkBalances(trade.escrowWallet);
                    const solToSend = Math.max(0, (balances.sol * LAMPORTS_PER_SOL) - RENT_EXEMPTION) * 0.98;
                    const lamports = Math.floor(solToSend);

                    console.log('SOL balance:', balances.sol);
                    console.log('SOL to send:', solToSend / LAMPORTS_PER_SOL);
                    console.log('Keeping for rent:', RENT_EXEMPTION / LAMPORTS_PER_SOL);

                    // Create transaction
                    const solTransaction = new Transaction().add(
                        SystemProgram.transfer({
                            fromPubkey: senderKeypair.publicKey,
                            toPubkey: new PublicKey(trade.solana.recipient),
                            lamports: lamports
                        })
                    );
                    const solTx = await sendAndConfirmTransaction(
                        this.connection,
                        solTransaction,
                        [senderKeypair]
                    );
                    console.log('✅ SOL transfer successful:', solTx);
                    await this.db.collection('otc').updateOne({
                        _id: new ObjectId(trade._id)
                    }, {
                        $set: {
                            status: 'transferred_funds',
                            solTxId: solTx,
                            updatedAt: new Date()
                        }
                    });
                    console.log('✅ Trade completed successfully');
                    await this.db.collection('notifications').insertOne({
                        id: uuidv4(),
                        user_id: trade.creator.userId,
                        type: 'success',
                        title: 'OTC Trade Completed',
                        message: 'Your OTC trade has been completed.',
                        time: new Date(),
                        read: false
                    });
                }
            }
        } catch (error) {
            console.error('❌ Error processing OTC trades:', error);
        }
    }

    startProcessing() {
        if (!this.intervalId) {
            console.log('🚀 Starting OTC processor');
            this.intervalId = setInterval(() => {
                this.processOTCTrades();
            }, 10000);
        }
    }

    stopProcessing() {
        if (this.intervalId) {
            console.log('🛑 Stopping OTC processor');
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
} 