import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { 
  handleCreateConversation, 
  handleGetConversations, 
  handleGetMessages,
  handleUploadVoice,
  handleDeleteConversation
} from '../controllers/conversation.controller';

const router = Router();

// Ensure upload dir exists
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
};

router.use(requireAuth);

router.post('/', handleCreateConversation);
router.get('/', handleGetConversations);
router.get('/:id/messages', handleGetMessages);
router.post('/:id/voice', upload.single('voice'), handleUploadVoice);
router.delete('/:id', handleDeleteConversation);

export default router;
