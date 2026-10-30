/**
 * Only super admins may pass. Must run after `protect`.
 */
export const superAdminOnly = (req, res, next) => {
  if (req.user?.role !== 'superadmin') {
    return res.status(403).json({ message: 'Super admin access required' });
  }
  return next();
};

export default superAdminOnly;
