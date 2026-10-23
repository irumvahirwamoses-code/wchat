import Chat, {
  ACCESS_CAPABILITIES,
  ACCESS_ROLES,
  CIRCLE_ROLES,
  accessAllows,
  roleAllows,
  roleToAccess,
} from '../models/Chat.js';
import User from '../models/User.js';

/**
 * Circle Access Control (GBAC).
 *
 * One policy per Circle instead of one rule per member: the admin decides which
 * *role* may perform each capability (everyone / staff / admin) and every
 * member is measured against the same table. Because the answer comes from the
 * Circle rather than a pile of per-member ACLs, the same rules apply in chat,
 * in the Reels editor and at the door of an invite — all from one panel.
 */

const MEMBER_FIELDS = 'firstName lastName username profilePicture isOnline';

const isMember = (chat, userId) =>
  chat.users.some((member) => member.toString() === userId.toString());

/** The signed-in member's role in this Circle. */
export const circleRoleOf = (chat, userId) => {
  if (!userId) return 'member';
  if (chat.groupAdmin?.toString() === userId.toString()) return 'owner';
  const entry = (chat.memberRoles || []).find(
    (row) => row.user?.toString() === userId.toString()
  );
  return entry?.role || 'member';
};

const loadCircle = async (chatId, userId) => {
  if (!chatId?.match?.(/^[0-9a-fA-F]{24}$/)) {
    return { error: { status: 400, message: 'Invalid Circle id' } };
  }
  const chat = await Chat.findById(chatId).select(
    'chatName isGroupChat users groupAdmin memberRoles accessRules circleType'
  );
  if (!chat) return { error: { status: 404, message: 'Circle not found' } };
  if (!isMember(chat, userId)) {
    return { error: { status: 403, message: 'You are not a member of this Circle' } };
  }
  return { chat };
};

/** Fill in missing rules so a Circle created before a rule existed still works. */
export const normalizeRules = (rules) =>
  Object.fromEntries(
    ACCESS_CAPABILITIES.map((cap) => {
      const value = rules?.[cap];
      return [cap, ACCESS_ROLES.includes(value) ? value : 'everyone'];
    })
  );

/**
 * The single question everything else asks: may this member do this here?
 *
 * Used by the message and Circle-item controllers so a policy the admin set in
 * one place is enforced everywhere, with no branch per feature.
 */
export const can = (chat, userId, capability) => {
  // 1-on-1 conversations have no policy — only Circles are segmented.
  if (!chat.isGroupChat) return true;
  if (!isMember(chat, userId)) return false;
  return accessAllows(normalizeRules(chat.accessRules), circleRoleOf(chat, userId), capability);
};

/**
 * A refusal that says *which* role the capability needs, so the member knows
 * what to ask for instead of getting a bare "no".
 */
export const denyFor = (chat, capability) => {
  const required = normalizeRules(chat.accessRules)[capability] || 'everyone';
  return {
    status: 403,
    message:
      required === 'admin'
        ? 'Only a Circle admin can do that'
        : required === 'staff'
          ? 'Only Circle admins and moderators can do that'
          : 'You are not allowed to do that in this Circle',
  };
};

/** GET /api/chats/:id/access */
export const getAccess = async (req, res, next) => {
  try {
    const { error, chat } = await loadCircle(req.params.id, req.user._id);
    if (error) return res.status(error.status).json({ message: error.message });

    const privileged = new Map(
      (chat.memberRoles || []).map((row) => [String(row.user), row])
    );

    const users = await User.find({ _id: { $in: chat.users } })
      .select(MEMBER_FIELDS)
      .lean();

    const members = users.map((user) => {
      const row = privileged.get(String(user._id));
      const role = circleRoleOf(chat, user._id);
      return {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        profilePicture: user.profilePicture,
        isOnline: user.isOnline,
        role,
        access: roleToAccess(role),
        grantedBy: row?.grantedBy || null,
        grantedAt: row?.grantedAt || null,
      };
    });

    const yourRole = circleRoleOf(chat, req.user._id);

    res.json({
      chatId: chat._id,
      chatName: chat.chatName,
      role: yourRole,
      access: roleToAccess(yourRole),
      rules: normalizeRules(chat.accessRules),
      capabilities: ACCESS_CAPABILITIES,
      roles: CIRCLE_ROLES,
      canManage: roleAllows(yourRole, 'admin'),
      members: members.sort((a, b) => (a.access === b.access ? 0 : a.access === 'admin' ? -1 : 1)),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/chats/:id/access — { rules }
 *
 * Simplified policy management: the whole Circle policy arrives as one object,
 * is validated field by field, and any capability left out keeps its current
 * value rather than silently resetting to open.
 */
export const updateAccess = async (req, res, next) => {
  try {
    const { error, chat } = await loadCircle(req.params.id, req.user._id);
    if (error) return res.status(error.status).json({ message: error.message });

    if (!roleAllows(circleRoleOf(chat, req.user._id), 'admin')) {
      return res
        .status(403)
        .json({ message: 'Only a Circle admin can change access rules' });
    }

    const incoming = req.body?.rules;
    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
      return res.status(400).json({ message: 'rules must be an object' });
    }

    const current = normalizeRules(chat.accessRules);
    const unknown = Object.keys(incoming).filter((key) => !ACCESS_CAPABILITIES.includes(key));
    if (unknown.length) {
      return res.status(400).json({ message: `Unknown rule: ${unknown[0]}` });
    }

    const invalid = Object.entries(incoming).find(([, value]) => !ACCESS_ROLES.includes(value));
    if (invalid) {
      return res
        .status(400)
        .json({ message: `${invalid[0]} must be one of ${ACCESS_ROLES.join(', ')}` });
    }

    chat.accessRules = { ...current, ...incoming };
    await chat.save();

    const io = req.app.get('io');
    if (io) io.to(`chat:${chat._id}`).emit('chat access', { chatId: chat._id });

    res.json({ chatId: chat._id, rules: normalizeRules(chat.accessRules) });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/chats/:id/access/:userId — { role }
 *
 * Micro-level segmentation: a member can be promoted to moderator or admin (or
 * dropped back to member) without touching anyone else, and the Circle policy
 * starts applying to them immediately.
 */
export const setMemberRole = async (req, res, next) => {
  try {
    const { error, chat } = await loadCircle(req.params.id, req.user._id);
    if (error) return res.status(error.status).json({ message: error.message });

    const yourRole = circleRoleOf(chat, req.user._id);
    if (!roleAllows(yourRole, 'admin')) {
      return res.status(403).json({ message: 'Only a Circle admin can assign roles' });
    }

    const targetId = req.params.userId;
    if (!targetId?.match?.(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: 'Invalid member id' });
    }
    if (!isMember(chat, targetId)) {
      return res.status(400).json({ message: 'That person is not in this Circle' });
    }
    if (chat.groupAdmin?.toString() === targetId.toString()) {
      return res
        .status(400)
        .json({ message: 'The owner cannot be demoted — move the Circle instead' });
    }

    const role = req.body?.role;
    if (!CIRCLE_ROLES.includes(role) || role === 'owner') {
      return res
        .status(400)
        .json({ message: `role must be one of ${CIRCLE_ROLES.filter((r) => r !== 'owner').join(', ')}` });
    }
    // Nobody may hand out more privilege than they hold.
    if (!roleAllows(yourRole, role)) {
      return res.status(403).json({ message: 'You cannot grant a role above your own' });
    }

    const roles = (chat.memberRoles || []).filter(
      (row) => row.user?.toString() !== targetId.toString()
    );
    if (role !== 'member') {
      roles.push({ user: targetId, role, grantedBy: req.user._id });
    }
    chat.memberRoles = roles;
    await chat.save();

    const io = req.app.get('io');
    if (io) io.to(`chat:${chat._id}`).emit('chat access', { chatId: chat._id });

    res.json({ chatId: chat._id, userId: targetId, role });
  } catch (err) {
    next(err);
  }
};
