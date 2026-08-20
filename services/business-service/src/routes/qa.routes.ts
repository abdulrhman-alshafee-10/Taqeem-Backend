import { Router } from "express";
import { 
  getQuestions, askQuestion, answerQuestion, 
  voteQuestionHelpful, voteAnswerHelpful, reportQuestion
} from "../controllers/qa.controller.js";

const router = Router();

router.get("/businesses/:id/questions", getQuestions);
router.post("/businesses/:id/questions", askQuestion);
router.post("/questions/:qid/answers", answerQuestion);
router.post("/questions/:qid/helpful", voteQuestionHelpful);
router.post("/answers/:aid/helpful", voteAnswerHelpful);
router.post("/questions/:qid/report", reportQuestion);

export default router;
