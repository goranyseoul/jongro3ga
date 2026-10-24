import { deleteMe, getMe } from "@/lib/auth/handlers";

// GET: { account, profile } of the signed-in user. DELETE: delete the account and its customer data.
export const GET = getMe;
export const DELETE = deleteMe;
