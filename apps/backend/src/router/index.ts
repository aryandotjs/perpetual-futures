import { Router } from "express";
import { authRouter } from "./auth";
import { engineRouter } from "./engine";

export const appRouter = Router()

appRouter.use(authRouter)
appRouter.use(engineRouter)
