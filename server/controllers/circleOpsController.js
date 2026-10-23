import CircleOps, { OPS_ACTIONS } from '../models/CircleOps.js';
import Chat, { roleAllows } from '../models/Chat.js';
import User from '../models/User.js';

/**
 * Circle Operations — group automation & resource management.
 *
 * A Circle is managed as *one unit* rather than member by member: an admin can
 * start, stop or restart every resource at once, and a Circle that cannot be
 * fully brought back up is marked **broken** until a restart clears it. A
 * Circle can also be **moved** to another member so a different "system" runs
 * it, which is how the group itself stays available.
 */

const MEMBER_FIELDS = 'firstName lastName username profilePicture isOnline lastSeen';

const isMember = (chat, userId) =>
  chat.users.some((member) => member.toString() === userId.toString());

/** The signed-in member's role in this Circle. */
const circleRoleOf = (chat, userId) => {
  if (chat.groupAdmin?.toString() === userId.toString()) return 'owner';
  const entry = (chat.memberRoles || []).find(
    (row) => row.user?.toString() === userId.toString()
  );
  return entry?.role || 'member';
};

/**
 * Load the Circle with the fields ops need, or fail with a normalised error
 * the handlers can `return` straight to Express.
 */
const loadCircle = async (chatId, userId) => {
  if (!chatId?.match?.(/^[0-9a-fA-F]{24}$/)) {
    return { error: { status: 400, message: 'Invalid Circle id' } };
  }
  const chat = await Chat.findById(chatId).select(
    'chatName isGroupChat users groupAdmin memberRoles circleType'
  );
  if (!chat) return { error: { status: 404, message: 'Circle not found' } };
  if (!chat.isGroupChat) {
    return { error: { status: 400, message: 'Only Circles have operations' } };
  }
  if (!isMember(chat, userId)) {
    return { error: { status: 403, message: 'You are not a member of this Circle' } };
  }
  return { chat };
};

/** Admins only — every state-changing operation below starts here. */
const requireAdminRole = (chat, userId) => {
  if (!roleAllows(circleRoleOf(chat, userId), 'admin')) {
    return { status: 403, message: 'Only a Circle admin can manage operations' };
  }
  return null;
};

const log = (ops, actor, action, { from, to, note } = {}) => {
  ops.history.push({ actor, action, from, to, note });
  // Keep the audit trail bounded without ever losing the newest events.
  if (ops.history.length > 60) ops.history = ops.history.slice(-60);
};

const broadcast = (req, chatId, payload) => {
  const io = req.app.get('io');
  if (io) io.to(`chat:${chatId}`).emit('circle ops updated', payload);
};

/**
 * Fetch (creating if needed) the ops document and sync its resource list with
 * the current membership, so joining or leaving a Circle is reflected without
 * a separate bookkeeping step.
 */
const syncOps = async (chat) => {
  let ops = await CircleOps.findOne({ chat: chat._id });
  if (!ops) {
    ops = await CircleOps.create({
      chat: chat._id,
      state: 'running',
      history: [{ action: 'created', note: 'Circle operations enabled' }],
    });
  }
  return ops;
};

/** Real presence decides whether a resource is up — never a stored guess. */
const resourceStatusFor = async (chat, ops) => {
  const users = await User.find({ _id: { $in: chat.users } })
    .select(MEMBER_FIELDS)
    .lean();

  const failedIds = new Set((ops.failed || []).map((row) => String(row.member)));

  return users.map((user) => {
    const failed = failedIds.has(String(user._id));
    return {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      profilePicture: user.profilePicture,
      role: chat.groupAdmin?.toString() === String(user._id)
        ? 'owner'
        : (chat.memberRoles || []).find((row) => row.user?.toString() === String(user._id))
            ?.role || 'member',
      status: user.isOnline ? 'up' : 'down',
      // A resource that is down *and* was not recovered by the last restart.
      failedRestart: failed,
      lastSeen: user.lastSeen,
      isOnline: user.isOnline,
    };
  });
};

/** GET /api/circles/:chatId/ops */
export const getOps = async (req, res, next) => {
  try {
    const { error, chat } = await loadCircle(req.params.chatId, req.user._id);
    if (error) return res.status(error.status).json({ message: error.message });

    const ops = await syncOps(chat);
    const resources = await resourceStatusFor(chat, ops);

    res.json({
      chatId: chat._id,
      chatName: chat.chatName,
      state: ops.state,
      resources,
      up: resources.filter((r) => r.status === 'up').length,
      down: resources.filter((r) => r.status === 'down').length,
      failed: ops.failed,
      history: [...ops.history].sort((a, b) => new Date(b.at) - new Date(a.at)),
      yourRole: circleRoleOf(chat, req.user._id),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Bring every resource up (or down) together. This is the "manage the group as
 * a single unit" primitive: one action reaches every member.
 */
const setState = (nextState, action) => async (req, res, next) => {
  try {
    const { error, chat } = await loadCircle(req.params.chatId, req.user._id);
    if (error) return res.status(error.status).json({ message: error.message });

    const denied = requireAdminRole(chat, req.user._id);
    if (denied) return res.status(denied.status).json({ message: denied.message });

    const ops = await syncOps(chat);
    const from = ops.state;

    ops.state = nextState;
    // Starting again is how a broken Circle is declared healthy: nothing is
    // outstanding until the next restart proves otherwise.
    if (nextState !== 'broken') ops.failed = [];
    // `action` is the lifecycle verb ('start'/'stop'); `nextState` is the state
    // it lands on ('running'/'stopped'). The history enum only accepts verbs.
    log(ops, req.user._id, action, { from, to: nextState });
    await ops.save();

    const resources = await resourceStatusFor(chat, ops);
    broadcast(req, chat._id, { chatId: chat._id, state: ops.state });

    res.json({
      chatId: chat._id,
      state: ops.state,
      from,
      resources,
      up: resources.filter((r) => r.status === 'up').length,
      down: resources.filter((r) => r.status === 'down').length,
      history: [...ops.history].sort((a, b) => new Date(b.at) - new Date(a.at)),
    });
  } catch (err) {
    next(err);
  }
};

export const startCircle = setState('running', 'start');
export const stopCircle = setState('stopped', 'stop');

/**
 * POST /api/circles/:chatId/ops/restart
 *
 * Bring everything down and back up in one action. Any resource that is still
 * down afterwards *could not be restarted*, and one such failure marks the
 * whole Circle as broken — the group's availability is only as good as the
 * resource that could not come back.
 */
export const restartCircle = async (req, res, next) => {
  try {
    const { error, chat } = await loadCircle(req.params.chatId, req.user._id);
    if (error) return res.status(error.status).json({ message: error.message });

    const denied = requireAdminRole(chat, req.user._id);
    if (denied) return res.status(denied.status).json({ message: denied.message });

    const ops = await syncOps(chat);
    const from = ops.state;

    // Re-read presence so the restart judges resources on fresh information.
    const users = await User.find({ _id: { $in: chat.users } })
      .select('isOnline')
      .lean();
    const downIds = users.filter((u) => !u.isOnline).map((u) => u._id);

    ops.failed = downIds.map((member) => ({
      member,
      reason: 'still offline after restart',
      at: new Date(),
    }));
    // A Circle that cannot be fully brought back up is broken.
    ops.state = downIds.length ? 'broken' : 'running';
    log(ops, req.user._id, downIds.length ? 'broken' : 'restart', {
      from,
      to: ops.state,
      note: downIds.length
        ? `${downIds.length} resource(s) failed to restart`
        : 'all resources up',
    });
    await ops.save();

    const resources = await resourceStatusFor(chat, ops);
    broadcast(req, chat._id, { chatId: chat._id, state: ops.state });

    res.json({
      chatId: chat._id,
      state: ops.state,
      from,
      resources,
      up: resources.filter((r) => r.status === 'up').length,
      down: resources.filter((r) => r.status === 'down').length,
      failed: ops.failed,
      history: [...ops.history].sort((a, b) => new Date(b.at) - new Date(a.at)),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/circles/:chatId/ops/move — { userId }
 *
 * Move the Circle onto another member's "system": they become the owner and
 * the previous admin drops to moderator, so nothing is lost when the group is
 * handed over for high availability.
 */
export const moveCircle = async (req, res, next) => {
  try {
    const { error, chat } = await loadCircle(req.params.chatId, req.user._id);
    if (error) return res.status(error.status).json({ message: error.message });

    const denied = requireAdminRole(chat, req.user._id);
    if (denied) return res.status(denied.status).json({ message: denied.message });

    const targetId = req.body.userId;
    if (!targetId?.match?.(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: 'A valid userId is required' });
    }
    if (!isMember(chat, targetId)) {
      return res.status(400).json({ message: 'Only a member can be given the Circle' });
    }
    if (chat.groupAdmin?.toString() === targetId.toString()) {
      return res.status(400).json({ message: 'That member already runs this Circle' });
    }

    const fromAdmin = chat.groupAdmin;
    const roles = (chat.memberRoles || []).filter(
      (row) => row.user?.toString() !== targetId.toString()
    );

    // The old owner stays useful as a moderator instead of vanishing.
    if (fromAdmin) {
      const kept = roles.find((row) => row.user?.toString() === fromAdmin.toString());
      if (kept) kept.role = 'moderator';
      else
        roles.push({
          user: fromAdmin,
          role: 'moderator',
          grantedBy: req.user._id,
        });
    }

    chat.groupAdmin = targetId;
    chat.memberRoles = roles;
    await chat.save();

    const ops = await syncOps(chat);
    const previousState = ops.state;
    log(ops, req.user._id, 'move', {
      from: fromAdmin?.toString(),
      to: targetId.toString(),
      note: 'Circle moved to a new admin',
    });
    // A handover is a fresh start for the group.
    ops.state = 'running';
    ops.failed = [];
    await ops.save();

    const io = req.app.get('io');
    if (io) io.to(`chat:${chat._id}`).emit('chat settings', { chatId: chat._id });

    broadcast(req, chat._id, { chatId: chat._id, state: ops.state });

    res.json({
      chatId: chat._id,
      groupAdmin: targetId,
      previousAdmin: fromAdmin || null,
      state: ops.state,
      previousState,
      history: [...ops.history].sort((a, b) => new Date(b.at) - new Date(a.at)),
    });
  } catch (err) {
    next(err);
  }
};

export const OPS_ACTION_VALUES = OPS_ACTIONS;
