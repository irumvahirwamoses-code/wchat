import mongoose from 'mongoose';
import CircleDecision, {
  DECISION_KINDS,
  DECISION_STATES,
} from '../models/CircleDecision.js';
import Chat, { roleAllows } from '../models/Chat.js';
import { can, circleRoleOf, denyFor } from './accessController.js';

/**
 * Circle Decisions — a group decision support system (GDSS).
 *
 *  • **Parallel communication** — every member contributes ideas at the same
 *    time; each is stored the moment it is written, so nobody waits for a turn.
 *  • **Structured thinking** — `delphi` decisions run rounds of *anonymous*
 *    rating, so the group converges on the strongest idea rather than the
 *    loudest member; `vote` is the single-round form.
 *  • **Shared workspace** — an idea can stay personal while its author works on
 *    it, then be **published** to the whole Circle.
 *  • **Recordkeeping** — every action is appended to `log` automatically, which
 *    is what the Circle reviews later.
 */

const AUTHOR_FIELDS = 'firstName lastName username profilePicture';

const isMember = (chat, userId) =>
  chat.users.some((member) => member.toString() === userId.toString());

const loadDecision = async (id, userId) => {
  if (!mongoose.isValidObjectId(id)) {
    return { error: { status: 400, message: 'Invalid decision id' } };
  }
  const decision = await CircleDecision.findById(id).populate('chat', [
    'chatName',
    'isGroupChat',
    'users',
    'groupAdmin',
    'memberRoles',
  ]);
  if (!decision) return { error: { status: 404, message: 'Decision not found' } };
  const chat = decision.chat;
  if (!chat || !isMember(chat, userId)) {
    return { error: { status: 403, message: 'You are not a member of this Circle' } };
  }
  return { decision, chat };
};

const appendLog = (decision, actor, action, detail) => {
  decision.log.push({ actor, action, detail: String(detail || '').slice(0, 200) });
  if (decision.log.length > 200) decision.log = decision.log.slice(-200);
};

const broadcast = (req, decision, extra = {}) => {
  const io = req.app.get('io');
  if (io)
    io.to(`chat:${decision.chat._id}`).emit('decision updated', {
      decisionId: decision._id,
      chatId: decision.chat._id,
      state: decision.state,
      ...extra,
    });
};

/**
 * Shape a decision for the wire.
 *
 * Unpublished ideas are the author's own workspace, so they are only shown to
 * their author (and to admins/moderators, who moderate the session). Ratings
 * are never attached to a person — everyone sees the average and the count,
 * and a member is told their *own* score back so they can change it.
 */
const serialize = (decision, userId, role) => {
  const privileged = roleAllows(role, 'staff');
  const ideas = decision.ideas
    .filter((idea) => idea.published || privileged || String(idea.author?._id ?? idea.author) === String(userId))
    .map((idea) => {
      const mine = (idea.ratings || []).find(
        (rating) => String(rating.user) === String(userId)
      );
      const total = (idea.ratings || []).reduce((sum, rating) => sum + rating.score, 0);
      return {
        _id: idea._id,
        author: idea.author,
        text: idea.text,
        published: idea.published,
        round: idea.round,
        createdAt: idea.createdAt,
        average: idea.ratings.length ? Number((total / idea.ratings.length).toFixed(2)) : null,
        ratingCount: idea.ratings.length,
        myRating: mine ? mine.score : null,
        mine: String(idea.author?._id ?? idea.author) === String(userId),
      };
    })
    // Ranked view puts the strongest ideas first during a rating round.
    .sort((a, b) => (a.round === b.round ? (b.average ?? 0) - (a.average ?? 0) : b.round - a.round));

  return {
    _id: decision._id,
    chat: decision.chat?._id ?? decision.chat,
    chatName: decision.chat?.chatName,
    title: decision.title,
    prompt: decision.prompt,
    kind: decision.kind,
    state: decision.state,
    round: decision.round,
    ideas,
    ideaCount: decision.ideas.length,
    publishedCount: decision.ideas.filter((idea) => idea.published).length,
    decision: decision.decision?.text
      ? {
          text: decision.decision.text,
          idea: decision.decision.idea,
          decidedAt: decision.decision.decidedAt,
        }
      : null,
    log: [...decision.log].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 60),
    yourRole: role,
  };
};

/** POST /api/circles/:chatId/decisions */
export const createDecision = async (req, res, next) => {
  try {
    const chat = await Chat.findById(req.params.chatId).select(
      'chatName isGroupChat users groupAdmin memberRoles accessRules'
    );
    if (!chat) return res.status(404).json({ message: 'Circle not found' });
    if (!isMember(chat, req.user._id)) {
      return res.status(403).json({ message: 'You are not a member of this Circle' });
    }
    if (!can(chat, req.user._id, 'startDecisions')) {
      const denied = denyFor(chat, 'startDecisions');
      return res.status(denied.status).json({ message: denied.message });
    }

    const { title, prompt = '', kind = 'brainstorm' } = req.body || {};
    if (!title?.trim()) return res.status(400).json({ message: 'A decision needs a title' });
    if (!DECISION_KINDS.includes(kind)) {
      return res
        .status(400)
        .json({ message: `kind must be one of ${DECISION_KINDS.join(', ')}` });
    }

    const decision = await CircleDecision.create({
      chat: chat._id,
      title: title.trim(),
      prompt: String(prompt).trim(),
      kind,
      state: 'collecting',
      round: 0,
      ideas: [],
      log: [
        {
          actor: req.user._id,
          action: 'created',
          detail: `Opened a ${kind} decision`,
        },
      ],
    });

    broadcast(req, decision, { action: 'created' });
    res.status(201).json(serialize(await decision.populate('chat', ['chatName']), req.user._id, 'member'));
  } catch (err) {
    next(err);
  }
};

/** GET /api/circles/:chatId/decisions — the Circle's decision history. */
export const listDecisions = async (req, res, next) => {
  try {
    const chat = await Chat.findById(req.params.chatId).select(
      'chatName isGroupChat users'
    );
    if (!chat) return res.status(404).json({ message: 'Circle not found' });
    if (!isMember(chat, req.user._id)) {
      return res.status(403).json({ message: 'You are not a member of this Circle' });
    }

    const decisions = await CircleDecision.find({ chat: chat._id })
      .sort({ updatedAt: -1 })
      .limit(100);

    const role = circleRoleOf(chat, req.user._id);
    res.json(decisions.map((decision) => serialize(decision, req.user._id, role)));
  } catch (err) {
    next(err);
  }
};

/** GET /api/decisions/:id */
export const getDecision = async (req, res, next) => {
  try {
    const { error, decision, chat } = await loadDecision(req.params.id, req.user._id);
    if (error) return res.status(error.status).json({ message: error.message });
    res.json(serialize(decision, req.user._id, circleRoleOf(chat, req.user._id)));
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/decisions/:id/ideas — { text }
 *
 * Parallel communication: everyone writes at the same time and each idea is
 * persisted straight away, so a fast typist cannot block a slower one.
 */
export const addIdea = async (req, res, next) => {
  try {
    const { error, decision, chat } = await loadDecision(req.params.id, req.user._id);
    if (error) return res.status(error.status).json({ message: error.message });

    if (decision.state === 'decided') {
      return res.status(400).json({ message: 'This decision is already closed' });
    }

    const text = String(req.body?.text || '').trim();
    if (!text) return res.status(400).json({ message: 'An idea needs some text' });
    if (text.length > 1000) {
      return res.status(400).json({ message: 'Idea text is limited to 1000 characters' });
    }

    const idea = {
      author: req.user._id,
      text,
      // Ideas written during a rating round belong to that round.
      round: decision.state === 'rating' ? decision.round : 0,
      // A member may keep an idea in their own workspace first, then publish
      // it to the whole Circle whenever it is ready.
      published: req.body?.published === false ? false : true,
    };

    // Parallel contributions arrive at the same time, so append atomically
    // instead of read-modify-save: two members writing at once must both land.
    const updated = await CircleDecision.findOneAndUpdate(
      { _id: decision._id, state: { $ne: 'decided' } },
      {
        $push: {
          ideas: idea,
          log: {
            $each: [
              {
                actor: req.user._id,
                action: 'idea',
                detail: text.slice(0, 80),
                at: new Date(),
              },
            ],
            $slice: -200,
          },
        },
      },
      { new: true }
    );
    if (!updated) {
      return res.status(400).json({ message: 'This decision is already closed' });
    }
    updated.chat = chat;

    broadcast(req, updated, { action: 'idea' });
    res
      .status(201)
      .json(serialize(updated, req.user._id, circleRoleOf(chat, req.user._id)));
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/decisions/:id/ideas/:ideaId/publish
 *
 * The shared-workspace half of the model: hold an idea back while you work on
 * it, then push it to the whole Circle when it is ready.
 */
export const publishIdea = async (req, res, next) => {
  try {
    const { error, decision, chat } = await loadDecision(req.params.id, req.user._id);
    if (error) return res.status(error.status).json({ message: error.message });

    const idea = decision.ideas.id(req.params.ideaId);
    if (!idea) return res.status(404).json({ message: 'Idea not found' });

    const privileged = roleAllows(circleRoleOf(chat, req.user._id), 'staff');
    if (String(idea.author) !== String(req.user._id) && !privileged) {
      return res.status(403).json({ message: 'That idea is not yours to publish' });
    }

    idea.published = !idea.published;
    appendLog(decision, req.user._id, idea.published ? 'publish' : 'unpublish', idea.text.slice(0, 80));
    await decision.save();

    broadcast(req, decision, { action: 'publish' });
    res.json(serialize(decision, req.user._id, circleRoleOf(chat, req.user._id)));
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/decisions/:id/ideas/:ideaId/rate — { score }
 *
 * Delphi-style anonymous rating: one score per member per idea, and the score
 * overwrites any earlier one, so a round is an evolving consensus rather than a
 * pile of duplicate votes.
 */
export const rateIdea = async (req, res, next) => {
  try {
    const { error, decision, chat } = await loadDecision(req.params.id, req.user._id);
    if (error) return res.status(error.status).json({ message: error.message });

    if (decision.state !== 'rating') {
      return res
        .status(400)
        .json({ message: 'Rating is only open while a round is running' });
    }

    const idea = decision.ideas.id(req.params.ideaId);
    if (!idea) return res.status(404).json({ message: 'Idea not found' });
    if (!idea.published) {
      return res.status(400).json({ message: 'That idea has not been published to the group' });
    }

    const score = Number(req.body?.score);
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      return res.status(400).json({ message: 'score must be a whole number from 1 to 5' });
    }

    const existing = (idea.ratings || []).find(
      (rating) => String(rating.user) === String(req.user._id)
    );

    // Ratings from different members can arrive together; each one is an
    // atomic update scoped to this idea so no score is lost.
    const logEntry = {
      actor: req.user._id,
      action: 'rate',
      detail: `rated an idea ${score}/5`,
      at: new Date(),
    };
    const arrayFilters = [{ 'idea._id': idea._id }];
    let update;

    if (existing) {
      arrayFilters.push({ 'rating.user': req.user._id });
      update = {
        $set: { 'ideas.$[idea].ratings.$[rating].score': score },
        $push: { log: { $each: [logEntry], $slice: -200 } },
      };
    } else {
      update = {
        $push: {
          'ideas.$[idea].ratings': { user: req.user._id, score },
          log: { $each: [logEntry], $slice: -200 },
        },
      };
    }

    const updated = await CircleDecision.findByIdAndUpdate(decision._id, update, {
      new: true,
      arrayFilters,
    });
    if (!updated) return res.status(404).json({ message: 'Decision not found' });
    updated.chat = chat;

    // The recipient is told the result privately; no personal attribution.
    broadcast(req, updated, { action: 'rate' });
    res.json(serialize(updated, req.user._id, circleRoleOf(chat, req.user._id)));
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/decisions/:id/advance
 *
 * Walks the session forward: collecting → rating → (next round) → collecting.
 * Starting another round is how a Delphi decision converges — the group rates,
 * sees the aggregate, and then refines.
 */
export const advanceDecision = async (req, res, next) => {
  try {
    const { error, decision, chat } = await loadDecision(req.params.id, req.user._id);
    if (error) return res.status(error.status).json({ message: error.message });

    if (!roleAllows(circleRoleOf(chat, req.user._id), 'staff')) {
      return res.status(403).json({ message: 'Only staff can run a decision round' });
    }
    if (decision.state === 'decided') {
      return res.status(400).json({ message: 'This decision is already closed' });
    }

    const from = decision.state;
    if (from === 'collecting') {
      if (decision.ideas.filter((idea) => idea.published).length === 0) {
        return res
          .status(400)
          .json({ message: 'Publish at least one idea before rating it' });
      }
      decision.state = 'rating';
      decision.round += 1;
      appendLog(decision, req.user._id, 'round', `Round ${decision.round} opened for rating`);
    } else {
      // A finished round goes back to collection so the group can refine.
      decision.state = 'collecting';
      appendLog(decision, req.user._id, 'round', `Round ${decision.round} closed`);
    }
    await decision.save();

    broadcast(req, decision, { action: 'advance' });
    res.json(serialize(decision, req.user._id, circleRoleOf(chat, req.user._id)));
  } catch (err) {
    next(err);
  }
};

/** POST /api/decisions/:id/decide — { text?, ideaId? } */
export const decide = async (req, res, next) => {
  try {
    const { error, decision, chat } = await loadDecision(req.params.id, req.user._id);
    if (error) return res.status(error.status).json({ message: error.message });

    if (!roleAllows(circleRoleOf(chat, req.user._id), 'staff')) {
      return res.status(403).json({ message: 'Only staff can record a decision' });
    }
    if (decision.state === 'decided') {
      return res.status(400).json({ message: 'This decision is already recorded' });
    }

    let text = String(req.body?.text || '').trim();
    const ideaId = req.body?.ideaId;

    if (ideaId) {
      if (!mongoose.isValidObjectId(ideaId)) {
        return res.status(400).json({ message: 'Invalid idea id' });
      }
      const idea = decision.ideas.id(ideaId);
      if (!idea) return res.status(404).json({ message: 'Idea not found' });
      if (!text) text = idea.text;
      decision.decision.idea = idea._id;
    }

    if (!text) {
      return res.status(400).json({ message: 'A decision needs some text' });
    }

    decision.decision.text = text;
    decision.decision.decidedBy = req.user._id;
    decision.decision.decidedAt = new Date();
    decision.state = 'decided';
    appendLog(decision, req.user._id, 'decided', text.slice(0, 80));
    await decision.save();

    broadcast(req, decision, { action: 'decided' });
    res.json(serialize(decision, req.user._id, circleRoleOf(chat, req.user._id)));
  } catch (err) {
    next(err);
  }
};

export { AUTHOR_FIELDS };
