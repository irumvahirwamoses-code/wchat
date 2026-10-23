import express from 'express';
import {
  listChats,
  createChat,
  createGroupChat,
  addGroupMember,
  renameGroup,
  leaveGroup,
  deleteGroup,
  discoverGroups,
  sendJoinRequest,
  listJoinRequests,
  handleJoinRequest,
  followGroup,
  getChatSettings,
  updateChatSettings,
  pinMessage,
  unpinMessage,
  togglePinChat,
  joinByCode,
  getInviteCode,
} from '../controllers/chatController.js';
import {
  getAccess,
  updateAccess,
  setMemberRole,
} from '../controllers/accessController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Discovery & join requests
router.get('/discover', protect, discoverGroups);
router.get('/join-requests', protect, listJoinRequests);
router.put('/join-requests/:requestId', protect, handleJoinRequest);
// QR invite: redeem a code, or fetch one for a Circle you belong to.
router.post('/join/:code', protect, joinByCode);
router.post('/:id/invite', protect, getInviteCode);

// Group management
router.post('/group', protect, createGroupChat);
router.post('/group/add', protect, addGroupMember);
router.put('/group/rename', protect, renameGroup);
router.put('/group/leave', protect, leaveGroup);
router.delete('/group/:id', protect, deleteGroup);

// Chats
router.post('/', protect, createChat);
router.get('/', protect, listChats);
router.post('/:id/follow', protect, followGroup);
router.post('/:id/join-request', protect, sendJoinRequest);

// Per-chat settings: theme, nicknames, pinned messages, pinned chats
router.get('/:id/settings', protect, getChatSettings);
router.put('/:id/settings', protect, updateChatSettings);
router.post('/:id/pin-message', protect, pinMessage);
router.delete('/:id/pin-message/:messageId', protect, unpinMessage);
router.put('/:id/pin', protect, togglePinChat);

// Circle access control: one policy for the whole Circle, plus member roles.
router.get('/:id/access', protect, getAccess);
router.put('/:id/access', protect, updateAccess);
router.put('/:id/access/:userId', protect, setMemberRole);

export default router;
