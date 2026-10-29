import jwt from 'jsonwebtoken';

/**
 * Sign a JWT containing the user id.
 */
export const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '30d' });
};

export default generateToken;
