import { z, email } from 'zod'

export const signUpSchema = z.object({
    email: z.email(),
    password: z.string(),
    name: z.string()
})

export const signInSchema = z.object({
    email: z.email(),
    password: z.string()
})

export enum toEngineMessageType {
    ON_RAMP = "ON_RAMP",
    GET_BALANCE = "GET_BALANCE"
}

export type messageToEngine = {
    type: toEngineMessageType.ON_RAMP,
    data: {
        userId: string,
    }
}

export type apiToQuque = {
    data: {
        type: toEngineMessageType.ON_RAMP,
        userId: string
    }
}