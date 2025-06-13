import { MongoClient, Collection, Db, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();
// Types for Twitter API responses
interface TwitterUser {
  creation_date: string;
  user_id: string;
  username: string;
  name: string;
  follower_count: number;
  following_count: number;
  favourites_count: number;
  is_private: boolean | null;
  is_verified: boolean;
  is_blue_verified: boolean;
  location: string;
  profile_pic_url: string;
  profile_banner_url: string;
  description: string;
  external_url: string;
  number_of_tweets: number;
  bot: boolean;
  timestamp: number;
  has_nft_avatar: boolean;
  category: string | null;
  default_profile: boolean;
  default_profile_image: boolean;
  listed_count: number | null;
  verified_type: string | null;
}

interface Tweet {
  tweet_id: string;
  creation_date: string;
  text: string;
  media_url: string | null;
  video_url: string | null;
  user: TwitterUser;
  language: string;
  favorite_count: number;
  retweet_count: number;
  reply_count: number;
  quote_count: number;
  retweet: boolean;
  views: number;
  timestamp: number;
  video_view_count: number | null;
  in_reply_to_status_id: string | null;
  quoted_status_id: string | null;
  binding_values: any | null;
  expanded_url: string | null;
  retweet_tweet_id: string | null;
  extended_entities: any | null;
  conversation_id: string;
  retweet_status: any | null;
  quoted_status: any | null;
  bookmark_count: number;
  source: string | null;
  community_note: any | null;
}

interface TweetsResponse {
  results: Tweet[];
}

export class TwitterCache {
  private client: MongoClient;
  private readonly rapidApiKey: string;
  private readonly rapidApiHost: string;
  private db!: Db;
  constructor() {
    this.client = new MongoClient(process.env.MONGODB_URI || '');
    this.rapidApiKey = process.env.RAPID_API_KEY || '';
    this.rapidApiHost = 'twitter154.p.rapidapi.com';
    this.client.connect().then(() => {
      this.db = this.client.db('leveledup')
      console.log('Twitter Cache Connected to MongoDB')
      // this.run()
    })
  }

  getHeaders() {
    return {
      'x-rapidapi-key': this.rapidApiKey,
      'x-rapidapi-host': this.rapidApiHost
    }
  }

  async getUserDetails(username: string | null, userId: string | null): Promise<TwitterUser> {
    if (!username && !userId) {
      throw new Error('Either username or userId must be provided');
    }

    const query: any = {};
    if (username) {
      query.username = username;
    } else if (userId) {
      query.user_id = userId;
    }

    const querystring = new URLSearchParams(query).toString();

    // Fetch from API if not in cache
    const response = await fetch(
      `https://twitter154.p.rapidapi.com/user/details?${querystring}`,
      {
        headers: this.getHeaders()
      }
    );
    if (!response.ok) throw new Error(`Failed to fetch user details: ${response.statusText}`);
    const userData = await response.json() as TwitterUser;

    return userData;
  }

  async getUserTweets(userId: string, limit: number = 100): Promise<TweetsResponse> {
    // Check cache first
    // Fetch from API if not in cache
    const response = await fetch(
      `https://twitter154.p.rapidapi.com/user/tweets?limit=${limit}&user_id=${userId}&include_pinned=true`,
      {
        headers: this.getHeaders()
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch user tweets: ${response.statusText}`);
    }

    const tweetsData = await response.json() as TweetsResponse;
    return tweetsData;
  }

  
  async updateUser(userId: string, user_id_to_add: string | null = null) {
    try {
      const user = await this.db.collection('twitter-tracker').findOne({ user_id: userId })
      if (!user) {
        const userData = await this.getUserDetails(null, userId)
        await this.db.collection('twitter-tracker').insertOne({
          username: userData.username,
          user_id: userId,
          user_data: userData,
          tweets: [],
          users: user_id_to_add ? [user_id_to_add] : [],
          created_at: new Date()
        })
      } else {
        const userData = await this.getUserDetails(null, userId)
        await this.db.collection('twitter-tracker').updateOne({ user_id: userId }, { $set: { user_data: userData } })
      }

      // update users tweets
      const updatedUser = await this.db.collection('twitter-tracker').findOne({ user_id: userId })
      if (!updatedUser) {
        throw new Error('User not found')
      }
      const tweets = await this.getUserTweets(updatedUser.user_id)
      const existingTweetIds = updatedUser.tweets.map((tweet: Tweet) => tweet.tweet_id)
      if (tweets.results.length > 0) {
        // check by tweet_id if the tweet is already in the tweets array
        const nonExistingTweets = tweets.results.filter((tweet: Tweet) => !existingTweetIds.includes(tweet.tweet_id))
        if (nonExistingTweets.length > 0) {
          updatedUser.tweets = [...updatedUser.tweets, ...nonExistingTweets]
          for (const userId of updatedUser.users) {
            const user = await this.db.collection('users').findOne({ _id: new ObjectId(userId) })
            if (user && user.telegram_id) {
              const dict = {
                user_id: userId,
                alert_type: "twitter-tracker",
                username: updatedUser.username,
                tweets: nonExistingTweets,
                created_at: new Date(),
                sent: false
              }
              await this.db.collection('alerts').insertOne(dict)
              console.log(`Alerted ${user.username} about ${updatedUser.username} new tweets`)
            }
          }
        }

       
        
      }
      console.log(`Updated ${updatedUser.username} tweets to ${updatedUser.tweets.length}`)
      await this.db.collection('twitter-tracker').updateOne({ user_id: userId }, { $set: { tweets: updatedUser.tweets } })
    } catch (error) {
      console.error(`Error updating user ${userId}: ${error}`)
    }
  }

  async getTrackedUser(userId: string) {
    return await this.db.collection('twitter-tracker').findOne({ user_id: userId });
  }

  async getAllTrackedUsers(withTweets: boolean = false) {
    if (withTweets) {
      return await this.db.collection('twitter-tracker').find({}).toArray();
    }
    return await this.db.collection('twitter-tracker').find({}, { projection: { tweets: 0 } }).toArray();
    
  }

  async updateTrackerUsersList(userId: string, users: string[]) {
    return await this.db.collection('twitter-tracker').updateOne({ user_id: userId }, { $set: { users: users } })
  }

  async run() {
    const users = await this.db.collection('twitter-tracker').find({}).toArray()
    console.log(`Updating ${users.length} users`)

    for (const user of users) {
      if (user.users.length > 0) {
        await this.updateUser(user.user_id)
      }
    }
    setInterval(async () => {
      const users = await this.db.collection('twitter-tracker').find({username: 'Karpz_'}).toArray()
      for (const user of users) {
        await this.updateUser(user.user_id)
      }
    }, 1000 * 60 * 5)  // 5 minutes
  }
  
}
