import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { signToken } from '../middleware/auth.js';
import { conflict, ok, unauthorized } from '../utils/http.js';
import { loginSchema, registerSchema } from '../validators/schemas.js';

export async function register(req, res) {
  const body = registerSchema.parse(req.body);
  const email = body.email.toLowerCase();
  if (await User.exists({ email })) throw conflict('An account with this email already exists');
  const user = await User.create({ name: body.name, email, phone: body.phone, passwordHash: await bcrypt.hash(body.password, 12), role: 'citizen' });
  ok(res, { token: signToken(user), user: user.toSafeJSON() }, null, 201);
}

export async function login(req, res) {
  const { email, password } = loginSchema.parse(req.body);
  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  // same message either way so emails can't be enumerated
  if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) throw unauthorized('Invalid email or password');
  ok(res, { token: signToken(user), user: user.toSafeJSON() });
}

export const me = (req, res) => ok(res, { user: req.user.toSafeJSON() });

// Tokens are stateless; the client discards its token.
export const logout = (req, res) => ok(res, { loggedOut: true });
