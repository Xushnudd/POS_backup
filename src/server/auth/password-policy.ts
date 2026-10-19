import { z } from 'zod'
// bcrypt only uses the first 72 UTF-8 bytes; never silently accept a longer new password.
export const newPasswordSchema=z.string().min(8).max(72).refine(value=>Buffer.byteLength(value,'utf8')<=72,'Parol UTF-8 bo‘yicha 72 baytdan oshmasin')
