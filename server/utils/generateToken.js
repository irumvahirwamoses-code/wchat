import jwt from 'jsonwebtoken';

/**
 * Sign a JWT containing the user id, valid for 30 days.
 */
export const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

export default generateToken;
