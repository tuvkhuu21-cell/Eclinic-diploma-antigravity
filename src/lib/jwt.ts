import jwt from "jsonwebtoken";

export type AuthRole = "PATIENT" | "DOCTOR" | "HOSPITAL" | "ADMIN";
export type JwtPayload = { userId: string; role: AuthRole };

const secret = process.env.JWT_SECRET || "dev-secret-change-me";
const expiresIn = (process.env.JWT_EXPIRES_IN || "7d") as jwt.SignOptions["expiresIn"];

export function signJwt(payload: JwtPayload) {
  return jwt.sign(payload, secret, { expiresIn });
}

export function verifyJwt(token: string) {
  return jwt.verify(token, secret) as JwtPayload;
}

