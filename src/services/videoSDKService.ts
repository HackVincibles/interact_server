import axios from 'axios';
import jwt from 'jsonwebtoken';

const VIDEOSDK_API_KEY = process.env.VIDEOSDK_API_KEY || '';
const VIDEOSDK_SECRET_KEY = process.env.VIDEOSDK_SECRET_KEY || '';
const VIDEOSDK_API_ENDPOINT = 'https://api.videosdk.live/v2';

export const generateVideoSDKToken = () => {
  const options = {
    expiresIn: '120m',
    algorithm: 'HS256',
  };
  const payload = {
    apikey: VIDEOSDK_API_KEY,
    permissions: ['ask_join', 'allow_join', 'allow_mod'], // Full permissions for our app
    version: 2,
  };
  // @ts-ignore
  return jwt.sign(payload, VIDEOSDK_SECRET_KEY, options);
};

export const createVideoSDKRoom = async () => {
  const token = generateVideoSDKToken();
  const url = `${VIDEOSDK_API_ENDPOINT}/rooms`;
  
  try {
    const response = await axios.post(
      url,
      {},
      {
        headers: {
          Authorization: token,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data.roomId;
  } catch (error: any) {
    console.error('Error creating VideoSDK room:', error.response?.data || error.message);
    throw new Error('Failed to create meeting room');
  }
};
