import { Router, Request, Response, NextFunction } from 'express';
import { 
  handleGetInviteCode, 
  handleGenerateInviteCode, 
  handleRevokeInviteCode, 
  handleGetFriends, 
  handleSendFriendRequest, 
  handleGetPendingRequests, 
  handleRespondToFriendRequest 
} from '../controllers/friend.controller';

const router = Router();

const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
};

router.use(requireAuth);

router.get('/invite', handleGetInviteCode);
router.post('/invite', handleGenerateInviteCode);
router.post('/invite/revoke', handleRevokeInviteCode);

router.get('/friends', handleGetFriends);
router.post('/friends/request', handleSendFriendRequest);
router.get('/friends/requests/pending', handleGetPendingRequests);
router.post('/friends/respond', handleRespondToFriendRequest);

export default router;
