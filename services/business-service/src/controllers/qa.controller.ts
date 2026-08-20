import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { publishEvent } from "../events/publisher.js";

const prisma = new PrismaClient();

function getUserContext(req: Request) {
  return { id: req.headers["x-user-id"] as string || "00000000-0000-0000-0000-000000000000" };
}

export async function getQuestions(req: Request, res: Response) {
  const { id } = req.params; // businessId
  const questions = await prisma.businessQuestion.findMany({
    where: { businessId: id, isHidden: false },
    include: {
      answers: {
        orderBy: [
          { isOwner: "desc" },
          { helpfulCount: "desc" }
        ]
      }
    },
    orderBy: { createdAt: "desc" }
  });
  res.json(questions);
}

export async function askQuestion(req: Request, res: Response) {
  const ctx = getUserContext(req);
  const { id } = req.params; // businessId
  const { body } = req.body;

  if (!ctx.id) return res.status(401).json({ error: "Unauthorized" });

  const question = await prisma.businessQuestion.create({
    data: { businessId: id, askerId: ctx.id, body }
  });

  await publishEvent("question.asked", { questionId: question.id, businessId: id, askerId: ctx.id });
  res.status(201).json(question);
}

export async function answerQuestion(req: Request, res: Response) {
  const ctx = getUserContext(req);
  const { qid } = req.params;
  const { body } = req.body;

  if (!ctx.id) return res.status(401).json({ error: "Unauthorized" });

  const question = await prisma.businessQuestion.findUnique({ where: { id: qid } });
  if (!question) return res.status(404).json({ error: "Question not found" });

  const biz = await prisma.business.findUnique({ where: { id: question.businessId } });
  const isOwner = biz?.ownerId === ctx.id;

  const answer = await prisma.businessAnswer.create({
    data: { questionId: qid, authorId: ctx.id, body, isOwner }
  });

  await publishEvent("question.answered", { questionId: qid, answerId: answer.id, authorId: ctx.id, isOwner });
  res.status(201).json(answer);
}

export async function voteQuestionHelpful(req: Request, res: Response) {
  const { qid } = req.params;
  const question = await prisma.businessQuestion.update({
    where: { id: qid },
    data: { helpfulCount: { increment: 1 } }
  });
  res.json(question);
}

export async function voteAnswerHelpful(req: Request, res: Response) {
  const { aid } = req.params;
  const answer = await prisma.businessAnswer.update({
    where: { id: aid },
    data: { helpfulCount: { increment: 1 } }
  });
  res.json(answer);
}

export async function reportQuestion(req: Request, res: Response) {
  const { qid } = req.params;
  // Normally flag in DB for moderation
  res.json({ success: true, message: "Question reported" });
}
